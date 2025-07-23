import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { useRef } from "react";

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function Section({ title, children }) {
  return (
    <section className="pt-8">
      <h2 className="text-xl font-serif font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-1 tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function PortfolioPage() {
  const location = useLocation();
  const data = location.state?.portfolioData;
  if (!data) return (
    <div className="p-10">
      <div>No portfolio data found.</div>
      <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">{JSON.stringify(location.state, null, 2)}</pre>
    </div>
  );

  // Academic JSON fields
  const profile = data.profile || {};
  const education = data.education || [];
  const positions = data.positions || [];
  const projects = data.projects || [];
  const publications = data.publications || [];
  const skills = data.skills || {};
  const awards = data.awards || [];
  const researchInterests = data.research_interests || [];
  const contact = profile.email || profile.phone || profile.location;

  // Group skills by category if present
  let skillsByCategory = {};
  if (skills && typeof skills === 'object' && !Array.isArray(skills)) {
    skillsByCategory = skills;
  } else if (Array.isArray(skills)) {
    // fallback for array format
    skillsByCategory = { Other: skills };
  }

  // Social links (if present)
  const socialLinks = Array.isArray(profile.social) ? profile.social : [];

  return (
    <div className="min-h-screen bg-white font-serif text-gray-900">
      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* Header */}
        <header className="mb-16 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">{profile?.name || "Academic Portfolio"}</h1>
          {profile?.location && <p className="text-lg text-gray-600 mb-4">{profile.location}</p>}
          {profile?.summary && (
            <p className="text-gray-700 max-w-3xl mx-auto leading-relaxed mb-6">{profile.summary}</p>
          )}
          <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-600">
            {profile?.email && <span>{profile.email}</span>}
            {profile?.phone && <span>• {profile.phone}</span>}
            {Array.isArray(profile?.social) && profile.social.map((link, i) => (
              <span key={i}>• <a href={link.url} className="text-blue-700 hover:underline">{link.platform}</a></span>
            ))}
          </div>
          <button
            onClick={() => downloadJSON(data, "academic-portfolio.json")}
            className="mt-6 px-6 py-2 bg-blue-900 text-white rounded-lg font-medium hover:bg-blue-800 transition-colors"
          >
            Download CV (JSON)
          </button>
        </header>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Left Column - 2/3 width */}
          <div className="lg:col-span-2 space-y-12">
            {/* Research Interests */}
            {researchInterests && researchInterests.length > 0 && (
              <Section title="Research Interests">
                <div className="bg-gray-50 rounded-lg p-6">
                  <p className="text-gray-700 leading-relaxed break-words whitespace-pre-line">{researchInterests}</p>
                </div>
              </Section>
            )}
            {/* Positions / Appointments */}
            {positions && positions.length > 0 && (
              <Section title="Positions / Appointments">
                <div className="space-y-6">
                  {positions.map((position, i) => (
                    <div key={i} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900 text-lg">{position.title}</h3>
                          <p className="text-blue-700 font-medium">{position.organization}</p>
                          {position.location && <p className="text-gray-600 text-sm">{position.location}</p>}
                        </div>
                        <span className="text-gray-500 text-sm mt-1 sm:mt-0">{position.dates}</span>
                      </div>
                      {position.summary && (
                        <p className="text-gray-700 mb-3 break-words whitespace-pre-line">{position.summary}</p>
                      )}
                      {position.highlights && position.highlights.length > 0 && (
                        <ul className="list-disc list-inside text-gray-700 space-y-1">
                          {position.highlights.map((highlight, j) => (
                            <li key={j} className="break-words">{highlight}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            )}
            {/* Projects */}
            {projects && projects.length > 0 && (
              <Section title="Projects">
                <div className="space-y-6">
                  {projects.map((project, i) => (
                    <div key={i} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3">
                        <h3 className="font-semibold text-gray-900 text-lg">{project.title}</h3>
                        {project.dates && <span className="text-gray-500 text-sm mt-1 sm:mt-0">{project.dates}</span>}
                      </div>
                      {project.description && (
                        <p className="text-gray-700 break-words whitespace-pre-line">{project.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            )}
            {/* Publications */}
            {publications && publications.length > 0 && (
              <Section title="Publications">
                <div className="space-y-4">
                  {publications.map((pub, i) => (
                    <div key={i} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                      <h3 className="font-semibold text-gray-900 mb-2">{pub.title}</h3>
                      <p className="text-gray-700 mb-2 break-words whitespace-pre-line">{pub.authors}</p>
                      <p className="text-blue-700 text-sm">{pub.venue}</p>
                      {pub.year && <p className="text-gray-500 text-sm">{pub.year}</p>}
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>

          {/* Right Column - 1/3 width */}
          <div className="lg:col-span-1 space-y-12">
            {/* Education */}
            {education && education.length > 0 && (
              <Section title="Education">
                <div className="space-y-6">
                  {education.map((edu, i) => (
                    <div key={i} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">{edu.degree}</h3>
                          <p className="text-blue-700 font-medium">{edu.institution}</p>
                          {edu.location && <p className="text-gray-600 text-sm">{edu.location}</p>}
                        </div>
                        <span className="text-gray-500 text-sm mt-1 sm:mt-0">{edu.dates}</span>
                      </div>
                      {edu.honors && <p className="text-gray-700 text-sm italic">{edu.honors}</p>}
                    </div>
                  ))}
                </div>
              </Section>
            )}
            {/* Honors & Awards */}
            {awards && awards.length > 0 && (
              <Section title="Honors & Awards">
                <div className="space-y-4">
                  {awards.map((award, i) => (
                    <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <h3 className="font-semibold text-gray-900 text-sm">{award.title}</h3>
                      <p className="text-gray-700 text-sm">{award.organization}</p>
                      {award.year && <p className="text-gray-500 text-xs">{award.year}</p>}
                    </div>
                  ))}
                </div>
              </Section>
            )}
            {/* Skills */}
            {skillsByCategory && Object.keys(skillsByCategory).length > 0 && (
              <Section title="Skills">
                <div className="space-y-4">
                  {Object.entries(skillsByCategory).map(([category, skillList]) => (
                    <div key={category} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <h3 className="font-semibold text-gray-900 text-sm mb-2">{category}</h3>
                      <div className="flex flex-wrap gap-2">
                        {skillList.map((skill, i) => (
                          <span key={i} className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}
            {/* Contact */}
            {contact && (
              <Section title="Contact">
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  <div className="space-y-2 text-sm">
                    {profile.email && <p><span className="font-medium">Email:</span> {profile.email}</p>}
                    {profile.phone && <p><span className="font-medium">Phone:</span> {profile.phone}</p>}
                    {profile.location && <p><span className="font-medium">Location:</span> {profile.location}</p>}
                  </div>
                </div>
              </Section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function HomePage() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(""); // Add error state
  const navigate = useNavigate();

  const handleUpload = (e) => {
    const uploadedFile = e.target.files[0];
    setFile(uploadedFile);
    setError(""); // Clear error on new upload
  };

  const handleGenerate = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    const formData = new FormData();
    formData.append("resume", file);
    try {
      const res = await fetch("http://localhost:3001/api/parse", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to parse resume");
      }
      const data = await res.json();
      setLoading(false);
      navigate("/portfolio", { state: { portfolioData: data } });
    } catch (err) {
      setLoading(false);
      setError(err.message || "An error occurred. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-white font-serif text-gray-900 flex flex-col items-center justify-center px-4 py-20">
      <div className="max-w-lg w-full bg-gray-50 rounded-lg shadow p-8 flex flex-col items-center">
        <h1 className="text-3xl font-bold mb-2 text-center">Resume → Academic Portfolio</h1>
        <p className="text-lg text-gray-700 mb-6 text-center">Upload your resume (PDF) and instantly generate a clean, professional academic website.</p>
        <label className="w-full flex flex-col items-center px-4 py-6 bg-white text-blue-900 rounded-lg shadow border-2 border-dashed border-blue-200 cursor-pointer hover:bg-blue-50 transition mb-4">
          <span className="mb-2 text-base font-semibold">Select your resume PDF</span>
          <input type="file" accept="application/pdf" onChange={handleUpload} className="hidden" />
          {file && <span className="mt-2 text-sm text-gray-700">{file.name}</span>}
        </label>
        {error && <div className="w-full mb-4 p-3 bg-red-100 text-red-700 rounded text-center">{error}</div>}
        <button
          onClick={handleGenerate}
          className="w-full mt-4 px-4 py-2 bg-blue-900 text-white rounded font-semibold text-lg shadow hover:bg-blue-800 disabled:opacity-50 transition"
          disabled={loading || !file}
        >
          {loading ? "Generating..." : "Generate Portfolio"}
        </button>
        <p className="text-xs text-gray-500 mt-6 text-center">Your data is processed locally and never leaves your device except for parsing.</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
      </Routes>
    </Router>
  );
} 