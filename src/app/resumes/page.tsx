import { ResumesWorkspace } from "@/components/resume/resumes-workspace";
import { listResumes } from "@/lib/db/queries";

export default async function ResumesPage() {
  const items = await listResumes();

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div>
        <p className="section-kicker">dossier</p>
        <h1 className="page-title">Резюме</h1>
      </div>
      <ResumesWorkspace resumes={items} />
    </div>
  );
}
