import {
  Resume,
  Profile,
  Skill,
  Work,
  Volunteer,
  Project,
  Education,
  Award,
  Certificate,
  Publication,
  Language,
  Interest,
  Reference,
} from "../types/resume";

export function makeMarkdownFromResume(resume: Resume) {
  const basics = resume?.basics || {};
  const lines: string[] = [];

  // Header with name and location
  lines.push(`# ${basics.name || "(no name)"} ${basics.location?.address ? `- ${basics.location.address}` : ""}`);
  if (basics.label) lines.push(`**${basics.label}**`);

  const contact: string[] = [];
  if (basics.email) contact.push(`Email: ${basics.email}`);
  if (basics.phone) contact.push(`Phone: ${basics.phone}`);
  const website = basics.url || basics.website;
  if (website) contact.push(`Website: ${website}`);
  if (contact.length) lines.push(contact.join(" • "));

  // separator
  if (basics.summary || contact.length || basics.label) lines.push("---");

  if (basics.summary) {
    lines.push(`${basics.summary}`);
  }

  // Profiles
  const profiles = basics.profiles || [];
  if (profiles.length) {
    lines.push("---");
    lines.push(`**Profiles**`);
    profiles.forEach((p: Profile) => lines.push(`- ${p.network ? `${p.network}` : p.username || p.url}: ${p.url}`));
  }

  // Skills
  const skills = resume?.skills || [];
  if (skills.length) {
    lines.push("---");
    lines.push(`## Skills`);
    skills.forEach((s: Skill) => {
      const keywords = (s.keywords || []).slice(0, 8).join(", ");
      lines.push(`- **${s.name || "Skill"}** — ${keywords}`);
    });
  }

  // Work
  const work = resume?.work || [];
  if (work.length) {
    lines.push("---");
    lines.push(`## Work Experience`);
    work.forEach((w: Work) => {
      lines.push(`\n### ${w.position || "(position)"} — ${w.name || w.company || "(company)"}`);
      const dates = `${w.startDate || ""}${w.endDate ? ` — ${w.endDate}` : ""}`.trim();
      if (dates) lines.push(`*${dates}*`);
      if (w.summary) lines.push(`\n${w.summary}`);
      const highlights = w.highlights || [];
      if (highlights.length) {
        lines.push(`\n**Highlights**`);
        highlights.forEach((h: string) => lines.push(`- ${h}`));
      }
    });
  }

  // Volunteer
  const volunteer = resume?.volunteer || [];
  if (volunteer.length) {
    lines.push("---");
    lines.push(`## Volunteer`);
    volunteer.forEach((v: Volunteer) => {
      lines.push(`\n### ${v.position || "(position)"} — ${v.organization || "(organization)"}`);
      const dates = `${v.startDate || ""}${v.endDate ? ` — ${v.endDate}` : ""}`.trim();
      if (dates) lines.push(`*${dates}*`);
      if (v.summary) lines.push(`\n${v.summary}`);
      const highlights = v.highlights || [];
      if (highlights.length) {
        lines.push(`\n**Highlights**`);
        highlights.forEach((h: string) => lines.push(`- ${h}`));
      }
    });
  }

  // Projects
  const projects = resume?.projects || [];
  if (projects.length) {
    lines.push("---");
    lines.push(`## Projects`);
    projects.forEach((p: Project) => {
      lines.push(`\n### ${p.url ? `[${p.name || "(project)"}](${p.url})` : p.name || "(project)"}`);
      const dates = `${p.startDate || ""}${p.endDate ? ` — ${p.endDate}` : ""}`.trim();
      if (dates) lines.push(`*${dates}*`);
      if (p.description) lines.push(`\n${p.description}`);
      const highlights = p.highlights || [];
      if (highlights.length) {
        lines.push(`\n**Highlights**`);
        highlights.forEach((h: string) => lines.push(`- ${h}`));
      }
      const keywords = p.keywords || [];
      if (keywords.length) lines.push(`*${keywords.join(", ")}*`);
    });
  }

  // Education
  const education = resume?.education || [];
  if (education.length) {
    lines.push("---");
    lines.push(`## Education`);
    education.forEach((e: Education) => {
      lines.push(`\n**${e.institution || "(institution)"}** — ${e.area || ""}`);
      const edDates = `${e.startDate || ""}${e.endDate ? ` — ${e.endDate}` : ""}`.trim();
      if (edDates) lines.push(`*${edDates}*`);
      const score = e.score || e.gpa;
      if (score) lines.push(`- Score: ${score}`);
    });
  }

  // Awards
  const awards = resume?.awards || [];
  if (awards.length) {
    lines.push("---");
    lines.push(`## Awards`);
    awards.forEach((a: Award) => {
      lines.push(`\n**${a.title || "(award)"}**${a.awarder ? ` — ${a.awarder}` : ""}`);
      if (a.date) lines.push(`*${a.date}*`);
      if (a.summary) lines.push(a.summary);
    });
  }

  // Certificates
  const certificates = resume?.certificates || [];
  if (certificates.length) {
    lines.push("---");
    lines.push(`## Certificates`);
    certificates.forEach((c: Certificate) => {
      const name = c.url ? `[${c.name || "(certificate)"}](${c.url})` : c.name || "(certificate)";
      lines.push(`- **${name}**${c.issuer ? ` — ${c.issuer}` : ""}${c.date ? ` (${c.date})` : ""}`);
    });
  }

  // Publications
  const publications = resume?.publications || [];
  if (publications.length) {
    lines.push("---");
    lines.push(`## Publications`);
    publications.forEach((p: Publication) => {
      const name = p.url ? `[${p.name || "(publication)"}](${p.url})` : p.name || "(publication)";
      lines.push(`\n**${name}**${p.publisher ? ` — ${p.publisher}` : ""}`);
      if (p.releaseDate) lines.push(`*${p.releaseDate}*`);
      if (p.summary) lines.push(p.summary);
    });
  }

  // Languages
  const languages = resume?.languages || [];
  if (languages.length) {
    lines.push("---");
    lines.push(`## Languages`);
    languages.forEach((l: Language) => lines.push(`- ${l.language} — ${l.fluency || ""}`));
  }

  // Interests
  const interests = resume?.interests || [];
  if (interests.length) {
    lines.push("---");
    lines.push(`## Interests`);
    interests.forEach((i: Interest) => {
      const keywords = (i.keywords || []).join(", ");
      lines.push(`- **${i.name || "Interest"}**${keywords ? ` — ${keywords}` : ""}`);
    });
  }

  // References
  const references = resume?.references || [];
  if (references.length) {
    lines.push("---");
    lines.push(`## References`);
    references.forEach((r: Reference) => {
      if (r.reference) lines.push(`> ${r.reference}`);
      if (r.name) lines.push(`— ${r.name}`);
    });
  }

  return lines.join("\n\n");
}
