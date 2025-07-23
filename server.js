/**
 * Website Generator - Express Server
 * 
 * This server handles PDF resume parsing and AI-powered organization.
 * It provides a REST API for the React frontend to upload and process resumes.
 */

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { IncomingForm } from "formidable";
import fs from "fs";
import pdf from "pdf-parse";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { nanoid } from "nanoid";
import OpenAI from "openai";

// Initialize Express app and PORT at the top
const app = express();
const PORT = process.env.PORT || 3001;

// Initialize OpenAI client for AI-powered resume organization
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Initialize local database for storing parsed resumes (fix: always provide default data)
const db = new Low(new JSONFile("resumes.json"), { resumes: [] });
await db.read();
db.data ||= { resumes: [] };

// Enable CORS for frontend communication
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

function normalizeHeader(str) {
  return str
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Line-based section extraction for robust parsing
 * This function handles varied section header formats more reliably than regex
 * 
 * @param {string} text - The full resume text
 * @param {string[]} sectionNames - Array of possible section header names
 * @returns {Object} Object with section names as keys and content as values
 */
function extractSectionsByLines(text, sectionNames) {
  const lines = text.split('\n').map(l => l.trim());
  const sectionIndices = {};
  const normalizedSectionNames = sectionNames.map(s => normalizeHeader(s));

  // Find all section header line indices (fuzzy/partial match)
  lines.forEach((line, idx) => {
    const normalizedLine = normalizeHeader(line);
    normalizedSectionNames.forEach((section, i) => {
      // Allow exact or partial match (section is substring of line or vice versa)
      if (
        normalizedLine === section ||
        normalizedLine.includes(section) ||
        section.includes(normalizedLine)
      ) {
        // Only set if not already found (first occurrence wins)
        if (sectionIndices[section] === undefined) {
          sectionIndices[section] = idx;
        }
      }
    });
  });

  // Extract content for each section
  const result = {};
  normalizedSectionNames.forEach((section, i) => {
    const startIdx = sectionIndices[section];
    if (startIdx !== undefined) {
      // Find the next section header or end of text
      let endIdx = lines.length;
      for (let j = i + 1; j < normalizedSectionNames.length; j++) {
        const nextIdx = sectionIndices[normalizedSectionNames[j]];
        if (nextIdx !== undefined && nextIdx > startIdx) {
          endIdx = nextIdx;
          break;
        }
      }
      result[section] = lines.slice(startIdx + 1, endIdx).join('\n').trim();
    } else {
      result[section] = '';
    }
  });

  return result;
}

/**
 * Clean array by removing empty, duplicate, or whitespace-only entries
 * 
 * @param {Array} arr - Array to clean
 * @returns {Array} Cleaned array
 */
function cleanArray(arr) {
  if (!Array.isArray(arr)) return [];
  return Array.from(new Set(arr.map(x => (typeof x === 'string' ? x.trim() : x)).filter(Boolean)));
}

/**
 * Parse work experience from resume text
 * Extracts position, company, location, dates, summary, and highlights
 * 
 * @param {string} text - Work experience section text
 * @returns {Array} Array of work experience objects
 */
function parseWorkExperience(text) {
  if (!text) return [];
  
  const lines = text.split('\n').filter(line => line.trim());
  const experiences = [];
  let currentExp = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Look for job title patterns (usually starts with capital letters)
    if (/^[A-Z][a-zA-Z\s&]+(?:Engineer|Developer|Manager|Director|Lead|Analyst|Consultant|Specialist|Coordinator|Assistant|Intern)/.test(line)) {
      if (Object.keys(currentExp).length > 0) {
        experiences.push(currentExp);
      }
      currentExp = { title: line };
    }
    // Look for company names (often in parentheses or after "at")
    else if (line.includes('(') && line.includes(')')) {
      const companyMatch = line.match(/\(([^)]+)\)/);
      if (companyMatch) {
        currentExp.organization = companyMatch[1];
      }
    }
    // Look for dates
    else if (/\d{4}/.test(line) && (line.includes('Present') || line.includes('Current') || line.includes('-') || line.includes('to'))) {
      currentExp.dates = line;
    }
    // Look for location
    else if (line.includes(',') && /[A-Z]{2}$/.test(line)) {
      currentExp.location = line;
    }
    // Look for bullet points or descriptions
    else if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
      if (!currentExp.highlights) currentExp.highlights = [];
      currentExp.highlights.push(line.substring(1).trim());
    }
    // Look for summary text
    else if (line.length > 20 && !currentExp.summary) {
      currentExp.summary = line;
    }
  }

  if (Object.keys(currentExp).length > 0) {
    experiences.push(currentExp);
  }

  return experiences.map(exp => ({
    ...exp,
    highlights: cleanArray(exp.highlights || [])
  }));
}

/**
 * Parse education from resume text
 * Extracts institution, degree, location, dates, and honors
 * 
 * @param {string} text - Education section text
 * @returns {Array} Array of education objects
 */
function parseEducation(text) {
  if (!text) return [];
  
  const lines = text.split('\n').filter(line => line.trim());
  const education = [];
  let currentEdu = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Look for degree patterns
    if (/Bachelor|Master|PhD|Doctorate|Associate|Certificate|Diploma/i.test(line)) {
      if (Object.keys(currentEdu).length > 0) {
        education.push(currentEdu);
      }
      currentEdu = { degree: line };
    }
    // Look for university names
    else if (/University|College|Institute|School/i.test(line) && !currentEdu.institution) {
      currentEdu.institution = line;
    }
    // Look for dates
    else if (/\d{4}/.test(line)) {
      currentEdu.dates = line;
    }
    // Look for location
    else if (line.includes(',') && /[A-Z]{2}$/.test(line)) {
      currentEdu.location = line;
    }
    // Look for honors/GPA
    else if (/GPA|Honors|Magna|Summa|Cum|Dean/i.test(line)) {
      currentEdu.honors = line;
    }
  }

  if (Object.keys(currentEdu).length > 0) {
    education.push(currentEdu);
  }

  return education;
}

/**
 * Parse skills from resume text
 * Groups skills by category if category headers are present
 * 
 * @param {string} text - Skills section text
 * @returns {Object} Object with skill categories as keys and skill arrays as values
 */
function parseSkills(text) {
  if (!text) return {};
  
  const lines = text.split('\n').filter(line => line.trim());
  const skills = {};
  let currentCategory = 'Other';

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Look for category headers
    if (/^[A-Z][a-zA-Z\s]+:$/.test(trimmed)) {
      currentCategory = trimmed.replace(':', '');
      skills[currentCategory] = [];
    }
    // Look for skill lists (comma-separated or bullet points)
    else if (trimmed.includes(',') || trimmed.startsWith('•') || trimmed.startsWith('-')) {
      const skillList = trimmed
        .replace(/^[•\-]\s*/, '')
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      if (!skills[currentCategory]) skills[currentCategory] = [];
      skills[currentCategory].push(...skillList);
    }
    // Single skills
    else if (trimmed.length > 0 && trimmed.length < 50) {
      if (!skills[currentCategory]) skills[currentCategory] = [];
      skills[currentCategory].push(trimmed);
    }
  }

  // Clean up skills
  Object.keys(skills).forEach(category => {
    skills[category] = cleanArray(skills[category]);
  });

  return skills;
}

// Helper: Concatenate only non-empty extracted sections for GPT prompt
function buildRelevantResumeText(sections, maxTotalLength = 8000) {
  // Only include unique, non-empty section contents
  let seen = new Set();
  let sectionEntries = Object.entries(sections)
    .filter(([k, v]) => v && v.trim().length > 0 && !seen.has(v.trim()) && seen.add(v.trim()));
  // Sort by length descending (longest first)
  sectionEntries.sort((a, b) => b[1].length - a[1].length);
  let totalLength = 0;
  let included = [];
  for (let [name, content] of sectionEntries) {
    if (totalLength + content.length > maxTotalLength) {
      // Truncate this section if needed
      let allowed = maxTotalLength - totalLength;
      if (allowed > 200) { // Only include if at least 200 chars
        included.push(`=== ${name} ===\n${content.slice(0, allowed)}`);
        totalLength += allowed;
      }
      break;
    } else {
      included.push(`=== ${name} ===\n${content}`);
      totalLength += content.length;
    }
  }
  return included.join('\n\n');
}

/**
 * Use OpenAI GPT-4 to organize and structure resume data
 * Converts raw parsed data into a clean academic JSON format
 * 
 * @param {string} rawText - Original PDF text
 * @param {Object} parsed - Initially parsed resume data
 * @returns {Object} Structured academic portfolio data
 */
async function gptOrganizeResume(relevantText, parsed) {
  const prompt = `
You are an expert academic CV parser. Given the following extracted resume sections and parsed fields, output a clean JSON object with these top-level fields: profile (name, email, phone, location, summary, social), education (array), positions (array: work, research, teaching), publications (array), projects (array), skills (grouped by category), awards (array), and optionally service, outreach, or presentations. 

Section headers in the resume may vary. Use the parsed fields as hints, but ALWAYS extract and summarize each section directly from the extracted sections, even if the parser missed it or the section header is non-standard. Do not leave any section blank if the information is present in the extracted sections. 

IMPORTANT: If the parsed fields contain relevant or more structured information for any section, ORGANIZE and MERGE that information into the final output for that section, so that no useful data from the parsed JSON is lost. The final output should be the best possible combination of both sources, with no duplication.

Output ONLY valid JSON, inside triple backticks, and nothing else. The JSON must have these keys: profile, education, positions, publications, projects, skills, awards. If a section is not present, use an empty array or object for that key.

Extracted Sections:\n${relevantText}

Parsed Fields:\n${JSON.stringify(parsed, null, 2)}

Output:
\`\`\`json
{ ... }
\`\`\`
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    max_tokens: 1800
  });

  // Extract JSON between triple backticks
  const match = completion.choices[0].message.content.match(/```json\s*([\s\S]*?)\s*```/i);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch (e) {
      throw new Error("GPT output was not valid JSON: " + e.message);
    }
  }
  throw new Error("Failed to extract JSON from GPT output");
}

/**
 * Extract basic contact information from resume text
 * Looks for name, email, phone, and location patterns
 * 
 * @param {string} text - Full resume text
 * @returns {Object} Object with contact information
 */
function extractContactInfo(text) {
  const nameMatch = text.match(/^([A-Z][a-z]+ [A-Z][a-z]+)/m);
  const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  const phoneMatch = text.match(/(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  const locationMatch = text.match(/([A-Z][a-z]+(?:[,\s]+[A-Z][a-z]+)*,\s*[A-Z]{2})/);

  return {
    name: nameMatch ? nameMatch[1] : "",
    email: emailMatch ? emailMatch[0] : "",
    phone: phoneMatch ? phoneMatch[0] : "",
    location: locationMatch ? locationMatch[1] : ""
  };
}

// Main API endpoint for resume parsing
app.post("/api/parse", (req, res) => {
  console.log("Received POST /api/parse");
  
  const form = new IncomingForm();
  
  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("Form parsing error:", err);
      return res.status(500).json({ error: "Failed to parse form data" });
    }

    // Robust file extraction: support array or object
    const fileObj = Array.isArray(files.resume) ? files.resume[0] : files.resume;
    if (!fileObj || !fileObj.filepath) {
      return res.status(400).json({ error: "No resume file uploaded" });
    }

    try {
      // Read and parse PDF
      const dataBuffer = fs.readFileSync(fileObj.filepath);
      const text = await pdf(dataBuffer);
      
      console.log("--- RAW PDF TEXT ---");
      console.log(text.text.substring(0, 500) + "...");
      
      // Debug: Log all possible section headers
      text.text.split('\n').forEach(line => {
        if (/^[A-Z][A-Za-z &]+$/.test(line.trim())) {
          console.log('Possible section header:', line.trim());
        }
      });
      
      // Expanded section names for robust extraction
      const sectionNames = [
        "Work Experience", "Professional Experience", "Founder & Product Experience", "Research Experience", "Experience", "Employment", "Positions", "Appointments",
        "Education", "Academic Background", "Academic Experience",
        "Skills", "Skills & Interests", "Technical Skills", "Core Competencies", "Laboratory & Fields", "Programming Languages", "Technologies", "Tools", "Frameworks", "Interests"
      ];
      
      // Extract sections using line-based parsing
      const sections = extractSectionsByLines(text.text, sectionNames);
      
      console.log("--- EXTRACTED SECTIONS ---");
      sectionNames.forEach(name => {
        const key = name.toLowerCase();
        console.log(`${name}:`, sections[key] ? "Found" : "Not found");
      });
      
      // Always extract contact info and ensure variables are defined
      const contactInfo = extractContactInfo(text.text) || {};
      const name = contactInfo.name || "";
      const email = contactInfo.email || "";
      const phone = contactInfo.phone || "";
      const location = contactInfo.location || "";
      
      // Parse sections using all found headers
      const work_experience = parseWorkExperience(
        sections["work experience"] ||
        sections["professional experience"] ||
        sections["founder & product experience"] ||
        sections["research experience"] ||
        sections["experience"] ||
        sections["employment"] ||
        sections["positions"] ||
        sections["appointments"]
      );
      const education = parseEducation(sections["education"] || sections["academic background"] || sections["academic experience"]);
      const skills = parseSkills(
        sections["skills"] ||
        sections["skills & interests"] ||
        sections["technical skills"] ||
        sections["core competencies"] ||
        sections["laboratory & fields"] ||
        sections["programming languages"] ||
        sections["technologies"] ||
        sections["tools"] ||
        sections["frameworks"] ||
        sections["interests"]
      );
      
      // Combine parsed data
      const parsed = { name, email, phone, location, work_experience, education, skills };
      // Build relevant text for GPT
      const relevantText = buildRelevantResumeText(sections, 8000); // 8k chars max
      // Always use GPT-4 to organize and summarize, passing all available info
      let academicJson;
      try {
        academicJson = await gptOrganizeResume(relevantText, parsed);
      } catch (e) {
        console.error("GPT organization failed", e);
        return res.status(500).json({ 
          error: "Failed to organize resume with GPT. Please try again or simplify your resume." 
        });
      }

      // Patch missing keys to ensure frontend always receives a complete object
      const requiredKeys = [
        'profile', 'education', 'positions', 'publications', 'projects', 'skills', 'awards'
      ];
      // Helper: get fallback from parsed data
      const parsedFallback = {
        profile: {
          name: parsed.name || '',
          email: parsed.email || '',
          phone: parsed.phone || '',
          location: parsed.location || '',
          summary: '',
          social: [], // <-- changed from {} to []
        },
        education: parsed.education || [],
        positions: parsed.work_experience || [],
        publications: [],
        projects: [],
        skills: parsed.skills || {},
        awards: [],
      };
      // If AI output is empty, use parsedFallback
      if (!academicJson || Object.keys(academicJson).length === 0) {
        academicJson = parsedFallback;
      } else {
        for (const key of requiredKeys) {
          if (!(key in academicJson) || academicJson[key] == null || (Array.isArray(academicJson[key]) && academicJson[key].length === 0) || (typeof academicJson[key] === 'object' && Object.keys(academicJson[key]).length === 0)) {
            academicJson[key] = parsedFallback[key];
          }
        }
      }
      // If positions is empty but work_experience exists, map it
      if ((academicJson.positions == null || academicJson.positions.length === 0) && parsed.work_experience && parsed.work_experience.length > 0) {
        academicJson.positions = parsed.work_experience;
      }

      // Store in database (optional, can be removed if not needed)
      db.data.resumes.push(academicJson);
      await db.write();
      
      res.status(200).json(academicJson);
      
    } catch (error) {
      console.error("PDF parsing error:", error);
      res.status(500).json({ error: "Failed to parse PDF. Please ensure it's a valid PDF file." });
    }
  });
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Website Generator server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
}); 