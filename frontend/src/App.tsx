import React from "react";
import { FileText } from "lucide-react";

import { GENERATION_STEPS, MINUTE_STATUS } from "./constants";
import { api, API_BASE } from "./lib/api";
import { canPreviewFile, inferMimeType, parseFilenameFromDisposition } from "./lib/files";
import { formatDateInput } from "./lib/date";
import type { CompanyAttendees, GeneratedMinutes, MeetingType, Project, SavedMinute, Template, TitleMode, Toast, View } from "./types";
import { ComposePage } from "./pages/ComposePage";
import { GenerationLoading, ResultPage } from "./pages/ResultPage";
import { MinutesPage } from "./pages/MinutesPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { TemplatesPage } from "./pages/TemplatesPage";

export function App() {
  const [savedMinutes, setSavedMinutes] = React.useState<SavedMinute[]>([]);
  const [editingMinuteId, setEditingMinuteId] = React.useState<string | null>(null);
  const [storedTranscript, setStoredTranscript] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const mainRef = React.useRef<HTMLElement | null>(null);
  const [view, setView] = React.useState<View>("compose");
  const [templates, setTemplates] = React.useState<Template[]>([]);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = React.useState("");
  const activeProjectId = React.useRef(selectedProjectId);
  activeProjectId.current = selectedProjectId;
  const isOpeningMinute = React.useRef(false);
  const [templateName, setTemplateName] = React.useState("");
  const [templateDescription, setTemplateDescription] = React.useState("");
  const [templateFile, setTemplateFile] = React.useState<File | null>(null);
  const [editingTemplateId, setEditingTemplateId] = React.useState<string | null>(null);
  const [projectName, setProjectName] = React.useState("");
  const [projectDescription, setProjectDescription] = React.useState("");
  const [projectTemplateIds, setProjectTemplateIds] = React.useState<string[]>([]);
  const [projectLocations, setProjectLocations] = React.useState<string[]>([]);
  const [projectCompanies, setProjectCompanies] = React.useState<string[]>([]);
  const [projectAttendees, setProjectAttendees] = React.useState<string[]>([]);
  const [projectLocationInput, setProjectLocationInput] = React.useState("");
  const [projectCompanyInput, setProjectCompanyInput] = React.useState("");
  const [projectAttendeeInput, setProjectAttendeeInput] = React.useState("");
  const [editingProjectId, setEditingProjectId] = React.useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState("");
  const [transcriptFile, setTranscriptFile] = React.useState<File | null>(null);
  const [meetingDatetime, setMeetingDatetime] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [author, setAuthor] = React.useState("");
  const [meetingType, setMeetingType] = React.useState<MeetingType>("in_person");
  const [attendees, setAttendees] = React.useState<CompanyAttendees[]>([{ company: "", attendeesText: "" }]);
  const [draggedAttendeeIndex, setDraggedAttendeeIndex] = React.useState<number | null>(null);
  const [attendeeDropIndex, setAttendeeDropIndex] = React.useState<number | null>(null);
  const [titleMode, setTitleMode] = React.useState<TitleMode>("ai");
  const [manualTitle, setManualTitle] = React.useState("");
  const [toast, setToast] = React.useState<Toast | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [generationProgress, setGenerationProgress] = React.useState(0);
  const [generationStepIndex, setGenerationStepIndex] = React.useState(0);
  const [generatedMinutes, setGeneratedMinutes] = React.useState<GeneratedMinutes | null>(null);

  function showToast(message: string, toastView: View = view) {
    setToast({ id: Date.now(), view: toastView, message });
  }

  const loadTemplates = React.useCallback(async () => {
    if (!selectedProjectId) { setTemplates([]); return; }
    const data = await api<Template[]>(`/api/v1/projects/${selectedProjectId}/meeting-templates`);
    if (activeProjectId.current !== selectedProjectId) return;
    setTemplates(data.map(item => ({ ...item, original_filename: item.template_data.file?.original_filename || "JSON 양식", size: item.template_data.file?.size || 0 })));
  }, [selectedProjectId]);

  const loadProjects = React.useCallback(async () => {
    const data = await api<Project[]>("/api/v1/projects");
    setProjects(data);
    setSelectedProjectId(current => data.some(item => item.id === current) ? current : data[0]?.id || "");
  }, []);

  const loadMinutes = React.useCallback(async () => {
    if (!selectedProjectId) { setSavedMinutes([]); return; }
    const data = await api<SavedMinute[]>(`/api/v1/projects/${selectedProjectId}/meeting-minutes`);
    if (activeProjectId.current === selectedProjectId) setSavedMinutes(data);
  }, [selectedProjectId]);

  React.useEffect(() => { loadProjects().catch(error => showToast(error.message)); }, [loadProjects]);
  React.useEffect(() => {
    if (isOpeningMinute.current) {
      isOpeningMinute.current = false;
      loadTemplates().catch(error => showToast(error.message));
      loadMinutes().catch(error => showToast(error.message));
      return;
    }
    setTemplates([]);
    setSavedMinutes([]);
    setEditingMinuteId(null);
    setSelectedTemplateId("");
    setTranscriptFile(null);
    setStoredTranscript("");
    setManualTitle("");
    setMeetingDatetime("");
    setLocation("");
    setAuthor("");
    setAttendees([{ company: "", attendeesText: "" }]);
    resetTemplateForm();
    loadTemplates().catch(error => showToast(error.message));
    loadMinutes().catch(error => showToast(error.message));
  }, [loadTemplates, loadMinutes]);

  React.useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  React.useEffect(() => {
    if (!isGenerating) {
      return;
    }

    const timer = window.setInterval(() => {
      setGenerationProgress((current) => Math.min(94, current + (current < 55 ? 9 : 4)));
      setGenerationStepIndex((current) => Math.min(GENERATION_STEPS.length - 1, current + 1));
    }, 1200);

    return () => window.clearInterval(timer);
  }, [isGenerating]);

  React.useEffect(() => {
    return () => {
      if (generatedMinutes?.url) {
        URL.revokeObjectURL(generatedMinutes.url);
      }
    };
  }, [generatedMinutes?.url]);

  async function uploadTemplate(event: React.FormEvent) {
    try {
      event.preventDefault();
      if (!templateName || !templateFile) {
        showToast("양식명과 파일을 입력하세요.", "templates");
        return;
      }

      const form = new FormData();
      form.append("name", templateName);
      form.append("description", templateDescription);
      form.append("file", templateFile);

      const response = await fetch(`${API_BASE}/api/v1/projects/${selectedProjectId}/meeting-templates/upload`, { method: "POST", body: form });
      if (!response.ok) {
        showToast("양식 업로드에 실패했습니다.", "templates");
        return;
      }

      setTemplateName("");
      setTemplateDescription("");
      setTemplateFile(null);
      showToast("양식이 등록되었습니다.", "templates");
      await loadTemplates();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "요청을 처리하지 못했습니다.", "templates");
    }
  }

  async function saveTemplate(event: React.FormEvent) {
    try {
      event.preventDefault();
      if (!selectedProjectId || !templateName || (!editingTemplateId && !templateFile)) {
        showToast(editingTemplateId ? "양식명을 입력하세요." : "양식명과 파일을 입력하세요.", "templates");
        return;
      }

      const form = new FormData();
      form.append("name", templateName);
      form.append("description", templateDescription);
      if (templateFile) {
        form.append("file", templateFile);
      }

      const response = await fetch(`${API_BASE}/api/v1/${editingTemplateId ? `meeting-templates/${editingTemplateId}/upload` : `projects/${selectedProjectId}/meeting-templates/upload`}`, {
        method: editingTemplateId ? "PATCH" : "POST",
        body: form,
      });
      if (!response.ok) {
        showToast(editingTemplateId ? "양식 수정에 실패했습니다." : "양식 업로드에 실패했습니다.", "templates");
        return;
      }

      showToast(editingTemplateId ? "양식이 수정되었습니다." : "양식이 등록되었습니다.", "templates");
      resetTemplateForm();
      await loadTemplates();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "요청을 처리하지 못했습니다.", "templates");
    }
  }

  function editTemplate(template: Template) {
    setEditingTemplateId(template.id);
    setTemplateName(template.name);
    setTemplateDescription(template.description || "");
    setTemplateFile(null);
  }

  function resetTemplateForm() {
    setEditingTemplateId(null);
    setTemplateName("");
    setTemplateDescription("");
    setTemplateFile(null);
  }

  async function updateTemplate(templateId: string, name: string, description: string, file: File | null) {
    try {
      if (!name.trim()) {
        showToast("양식명을 입력하세요.", "templates");
        return;
      }

      const form = new FormData();
      form.append("name", name.trim());
      form.append("description", description.trim());
      if (file) {
        form.append("file", file);
      }

      const response = await fetch(`${API_BASE}/api/v1/meeting-templates/${templateId}/upload`, { method: "PATCH", body: form });
      if (!response.ok) {
        showToast("양식 수정에 실패했습니다.", "templates");
        return;
      }

      showToast("양식이 수정되었습니다.", "templates");
      await loadTemplates();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "요청을 처리하지 못했습니다.", "templates");
    }
  }

  async function deleteTemplate(templateId: string) {
    try {
      if (!window.confirm("이 회의록 양식을 삭제할까요?")) {
        return;
      }

      const response = await fetch(`${API_BASE}/api/v1/meeting-templates/${templateId}`, { method: "DELETE" });
      if (!response.ok) {
        showToast("양식을 삭제하지 못했습니다.", "templates");
        return;
      }
      showToast("양식이 삭제되었습니다.", "templates");
      await loadTemplates();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "요청을 처리하지 못했습니다.", "templates");
    }
  }

  function resetProjectForm() {
    setEditingProjectId(null);
    setProjectName("");
    setProjectDescription("");
    setProjectTemplateIds([]);
    setProjectLocations([]);
    setProjectCompanies([]);
    setProjectAttendees([]);
    setProjectLocationInput("");
    setProjectCompanyInput("");
    setProjectAttendeeInput("");
  }

  function editProject(project: Project) {
    setEditingProjectId(project.id);
    setProjectName(project.name);
    setProjectDescription(project.description || "");
    setProjectTemplateIds(project.template_ids || []);
    setProjectLocations(project.locations || []);
    setProjectCompanies(project.companies || []);
    setProjectAttendees(project.attendees || []);
    setProjectLocationInput("");
    setProjectCompanyInput("");
    setProjectAttendeeInput("");
  }

  function toggleProjectTemplate(templateId: string) {
    setProjectTemplateIds((current) =>
      current.includes(templateId) ? current.filter((id) => id !== templateId) : [...current, templateId],
    );
  }

  async function saveProject(event: React.FormEvent) {
    try {
      event.preventDefault();
      if (!projectName.trim()) {
        showToast("프로젝트명을 입력하세요.", "projects");
        return;
      }

      const payload = {
        name: projectName.trim(),
        description: projectDescription.trim(),
        locations: projectLocations,
        companies: projectCompanies,
        attendees: projectAttendees,
      };

      const response = await fetch(`${API_BASE}/api/v1/projects${editingProjectId ? `/${editingProjectId}` : ""}`, {
        method: editingProjectId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        showToast("프로젝트를 저장하지 못했습니다.", "projects");
        return;
      }

      showToast(editingProjectId ? "프로젝트를 수정했습니다." : "프로젝트를 등록했습니다.", "projects");
      resetProjectForm();
      await loadProjects();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "요청을 처리하지 못했습니다.", "projects");
    }
  }

  async function deleteProject(projectId: string) {
    try {
      if (!window.confirm("이 프로젝트를 삭제할까요?")) {
        return;
      }

      const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}`, { method: "DELETE" });
      if (!response.ok) {
        showToast("프로젝트를 삭제하지 못했습니다.", "projects");
        return;
      }

      if (selectedProjectId === projectId) {
        setSelectedProjectId("");
      }
      showToast("프로젝트를 삭제했습니다.", "projects");
      await loadProjects();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "요청을 처리하지 못했습니다.", "projects");
    }
  }

  async function createDraft(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedProjectId || !selectedTemplateId || (!transcriptFile && !storedTranscript) || !meetingDatetime || !location || !author) {
      showToast("양식, 녹취 파일, 회의 일시, 장소, 작성자를 입력하세요.", "compose");
      return;
    }

    setIsGenerating(true);
    setView("compose");
    window.history.replaceState(null, "", window.location.pathname);
    setGenerationProgress(8);
    setGenerationStepIndex(0);
    setGeneratedMinutes(null);

    const payload = {
      template_id: selectedTemplateId,
      transcript_filename: transcriptFile?.name || "saved-transcript.txt",
      meeting_datetime: new Date(meetingDatetime).toISOString(),
      location,
      author,
      meeting_type: meetingType,
      attendees_by_company: attendees
        .filter((row) => row.company.trim())
        .map((row) => ({
          company: row.company.trim(),
          attendees: row.attendeesText
            .split(",")
            .map((name) => name.trim())
            .filter(Boolean),
        })),
      title_mode: titleMode,
      manual_title: titleMode === "manual" ? manualTitle : null,
    };

    const form = new FormData();
    form.append("payload", JSON.stringify(payload));
    form.append("transcript", transcriptFile || new File([storedTranscript], "saved-transcript.txt", { type: "text/plain" }));
    form.append("project_id", selectedProjectId);
    if (editingMinuteId) form.append("minute_id", editingMinuteId);

    try {
      const response = await fetch(`${API_BASE}/api/minutes/generate`, { method: "POST", body: form });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        showToast(error?.detail || "회의록 작성에 실패했습니다.", "compose");
        return;
      }

      const savedId = response.headers.get("x-minute-id");
      if (savedId) setEditingMinuteId(savedId);
      const saved = savedId ? await api<SavedMinute>(`/api/v1/meeting-minutes/${savedId}`) : null;
      await loadMinutes();
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const generatedTitle = saved?.title || (titleMode === "manual" ? manualTitle : "회의록");
      const previewPath = response.headers.get("x-preview-url") || "";
      const filename =
        response.headers.get("x-generated-filename") ||
        parseFilenameFromDisposition(disposition) ||
        `${generatedTitle || "generated_minutes"}.doc`;
      const mimeType = blob.type || inferMimeType(filename);
      const previewBlob = mimeType ? new Blob([blob], { type: mimeType }) : blob;
      const url = URL.createObjectURL(previewBlob);
      const result = {
        filename,
        url,
        previewUrl: previewPath ? `${API_BASE}${previewPath}` : "",
        size: blob.size,
        mimeType,
        titleMode,
        title: generatedTitle,
      };

      setIsGenerating(false);
      setGenerationProgress(100);
      setGeneratedMinutes(result);
      setView("result");
      window.history.pushState(null, "", "#download");
      window.requestAnimationFrame(() => {
        mainRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : "회의록 생성에 실패했습니다.", "compose");
    } finally {
      setIsGenerating(false);
    }
  }

  function draftInput() {
    return { template_id: selectedTemplateId || null, meeting_datetime: meetingDatetime, location, author,
      meeting_type: meetingType, title_mode: titleMode, manual_title: manualTitle,
      attendees_by_company: attendees.map(row => ({ company: row.company, attendees: row.attendeesText.split(",").map(name => name.trim()).filter(Boolean) })) };
  }

  async function saveMinute() {
    if (!selectedProjectId) { showToast("프로젝트를 먼저 등록하거나 선택하세요."); return; }
    setIsSaving(true);
    try {
      const input = draftInput();
      const previous = savedMinutes.find(item => item.id === editingMinuteId);
      const payload = { template_id: selectedTemplateId || null, title: manualTitle.trim() || previous?.title || "회의록",
        meeting_at: meetingDatetime ? new Date(meetingDatetime).toISOString() : null,
        attendees: input.attendees_by_company, status: previous?.status || MINUTE_STATUS.DRAFT,
        content: { ...previous?.content, input, transcript_text: transcriptFile ? await transcriptFile.text() : storedTranscript } };
      const saved = await api<SavedMinute>(editingMinuteId ? `/api/v1/meeting-minutes/${editingMinuteId}` : `/api/v1/projects/${selectedProjectId}/meeting-minutes`,
        { method: editingMinuteId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      setEditingMinuteId(saved.id);
      await loadMinutes();
      showToast("회의록을 저장했습니다.");
    } catch (error) { showToast(error instanceof Error ? error.message : "저장 실패"); }
    finally { setIsSaving(false); }
  }

  async function openMinute(id: string) {
    try {
      const minute = await api<SavedMinute>(`/api/v1/meeting-minutes/${id}`);
      const input = minute.content.input || {};
      isOpeningMinute.current = minute.project_id !== selectedProjectId;
      setSelectedProjectId(minute.project_id);
      setEditingMinuteId(minute.id);
      setSelectedTemplateId(minute.template_id || "");
      const meetingTime = input.meeting_datetime || minute.meeting_at;
      const date = meetingTime ? new Date(meetingTime) : null;
      setMeetingDatetime(date ? `${formatDateInput(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}` : "");
      setLocation(input.location || ""); setAuthor(input.author || "");
      setMeetingType(input.meeting_type || "in_person"); setTitleMode(input.title_mode || "manual");
      setManualTitle(input.manual_title || minute.title);
      setAttendees(toCompanyAttendees(input.attendees_by_company || minute.attendees));
      setTranscriptFile(null); setStoredTranscript(minute.content.transcript_text || "");
      setView("compose");
    } catch (error) { showToast(error instanceof Error ? error.message : "조회 실패"); }
  }

  function downloadGeneratedMinutes() {
    if (!generatedMinutes) {
      return;
    }
    const link = document.createElement("a");
    link.href = generatedMinutes.url;
    link.download = generatedMinutes.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function previewGeneratedMinutes() {
    if (!generatedMinutes) {
      return;
    }
    if (generatedMinutes.previewUrl) {
      window.open(generatedMinutes.previewUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (!canPreviewFile(generatedMinutes)) {
      showToast("미리보기 파일을 찾지 못했습니다. 다운로드로 확인하세요.", "result");
      return;
    }
    window.open(generatedMinutes.url, "_blank", "noopener,noreferrer");
  }

  const selectedProject = projects.find((project) => project.id === selectedProjectId) || null;
  React.useEffect(() => {
    if (editingMinuteId && selectedTemplateId) {
      return;
    }
    if (templates.length === 0) {
      setSelectedTemplateId("");
      return;
    }
    if (selectedTemplateId && !templates.some((template) => template.id === selectedTemplateId)) {
      setSelectedTemplateId("");
    }
  }, [editingMinuteId, selectedTemplateId, templates]);

  const pageTitle =
    view === "compose" && isGenerating
      ? "회의록 생성 중"
      : view === "result"
      ? "회의록 생성 완료"
      : view === "compose"
        ? "회의록 작성"
        : view === "minutes"
          ? "회의록 관리"
        : view === "templates"
          ? "회의록 양식 관리"
          : "프로젝트 관리";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <FileText size={28} />
          <div>
            <strong>회의록 자동 작성</strong>
            <span>Minutes Agent</span>
          </div>
        </div>
        <nav>
          <button className={view === "compose" ? "active" : ""} onClick={() => setView("compose")}>
            회의록 작성
          </button>
          <button className={view === "minutes" ? "active" : ""} onClick={() => setView("minutes")}>
            회의록 관리
          </button>
          <button className={view === "templates" ? "active" : ""} onClick={() => setView("templates")}>
            회의록 양식 관리
          </button>
          <button className={view === "projects" ? "active" : ""} onClick={() => setView("projects")}>
            프로젝트 관리
          </button>
        </nav>
      </aside>

      <main ref={mainRef}>
        <header className="topbar">
          <div>
            <h1>{pageTitle}</h1>
          </div>
        </header>

        {view === "result" && generatedMinutes ? (
          <ResultPage
            result={generatedMinutes}
            onDownload={downloadGeneratedMinutes}
            onPreview={previewGeneratedMinutes}
            onBack={() => {
              setGeneratedMinutes(null);
              setView("compose");
              window.history.replaceState(null, "", window.location.pathname);
            }}
          />
        ) : view === "compose" ? (
          isGenerating ? (
            <GenerationLoading progress={generationProgress} step={GENERATION_STEPS[generationStepIndex]} />
          ) : (
            <ComposePage
            templates={templates}
            projects={projects}
            selectedProject={selectedProject}
            selectedProjectId={selectedProjectId}
            setSelectedProjectId={setSelectedProjectId}
            selectedTemplateId={selectedTemplateId}
            setSelectedTemplateId={setSelectedTemplateId}
            setTranscriptFile={setTranscriptFile}
            meetingDatetime={meetingDatetime}
            setMeetingDatetime={setMeetingDatetime}
            location={location}
            setLocation={setLocation}
            author={author}
            setAuthor={setAuthor}
            meetingType={meetingType}
            setMeetingType={setMeetingType}
            attendees={attendees}
            setAttendees={setAttendees}
            draggedAttendeeIndex={draggedAttendeeIndex}
            setDraggedAttendeeIndex={setDraggedAttendeeIndex}
            attendeeDropIndex={attendeeDropIndex}
            setAttendeeDropIndex={setAttendeeDropIndex}
            titleMode={titleMode}
            setTitleMode={setTitleMode}
            manualTitle={manualTitle}
            setManualTitle={setManualTitle}
            isGenerating={isGenerating}
            createDraft={createDraft}
          />
          )
        ) : view === "minutes" ? (
          <MinutesPage onEditMinute={openMinute} />
        ) : view === "templates" ? (
          <TemplatesPage
            templates={templates}
            templateName={templateName}
            setTemplateName={setTemplateName}
            templateDescription={templateDescription}
            setTemplateDescription={setTemplateDescription}
            setTemplateFile={setTemplateFile}
            saveTemplate={saveTemplate}
            editingTemplateId={editingTemplateId}
            resetTemplateForm={resetTemplateForm}
            updateTemplate={updateTemplate}
            deleteTemplate={deleteTemplate}
          />
        ) : (
          <ProjectsPage
            projects={projects}
            templates={templates}
            projectName={projectName}
            setProjectName={setProjectName}
            projectDescription={projectDescription}
            setProjectDescription={setProjectDescription}
            projectTemplateIds={projectTemplateIds}
            toggleProjectTemplate={toggleProjectTemplate}
            projectLocations={projectLocations}
            setProjectLocations={setProjectLocations}
            projectLocationInput={projectLocationInput}
            setProjectLocationInput={setProjectLocationInput}
            projectCompanies={projectCompanies}
            setProjectCompanies={setProjectCompanies}
            projectCompanyInput={projectCompanyInput}
            setProjectCompanyInput={setProjectCompanyInput}
            projectAttendees={projectAttendees}
            setProjectAttendees={setProjectAttendees}
            projectAttendeeInput={projectAttendeeInput}
            setProjectAttendeeInput={setProjectAttendeeInput}
            editingProjectId={editingProjectId}
            saveProject={saveProject}
            editProject={editProject}
            deleteProject={deleteProject}
            resetProjectForm={resetProjectForm}
          />
        )}

        {toast && toast.view === view && <div className="toast-message">{toast.message}</div>}
      </main>
    </div>
  );
}

function toCompanyAttendees(value: unknown): CompanyAttendees[] {
  if (!Array.isArray(value)) {
    return [{ company: "", attendeesText: "" }];
  }
  const attendees = value
    .map((row) => {
      if (!row || typeof row !== "object") {
        return null;
      }
      const item = row as { company?: unknown; attendees?: unknown };
      return {
        company: typeof item.company === "string" ? item.company : "",
        attendeesText: Array.isArray(item.attendees) ? item.attendees.map(String).join(", ") : "",
      };
    })
    .filter((row): row is CompanyAttendees => row !== null);
  return attendees.length ? attendees : [{ company: "", attendeesText: "" }];
}
