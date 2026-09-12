import React from "react";
import { Download, Trash2 } from "lucide-react";

import type { Template } from "../types";
import { API_BASE } from "../lib/api";
import { FilePicker } from "../components/FilePicker";

export function TemplatesPage(props: {
  templates: Template[];
  templateName: string;
  setTemplateName: (value: string) => void;
  templateDescription: string;
  setTemplateDescription: (value: string) => void;
  setTemplateFile: (file: File | null) => void;
  saveTemplate: (event: React.FormEvent) => void;
  editingTemplateId: string | null;
  resetTemplateForm: () => void;
  updateTemplate: (templateId: string, name: string, description: string, file: File | null) => Promise<void>;
  deleteTemplate: (templateId: string) => void;
}) {
  return (
    <div className="workspace two-column">
      <section className="panel template-list-panel">
        <h2>양식 목록</h2>
        <div className="template-list">
          {props.templates.length === 0 ? (
            <p className="empty">등록된 양식이 없습니다.</p>
          ) : (
            props.templates.map((template) => (
              <TemplateListItem
                key={template.id}
                template={template}
                updateTemplate={props.updateTemplate}
                deleteTemplate={props.deleteTemplate}
              />
            ))
          )}
        </div>
      </section>

      <form className="panel template-upload-panel" onSubmit={props.saveTemplate}>
        <h2>{props.editingTemplateId ? "회의록 양식 수정" : "회의록 양식 업로드"}</h2>
        <label>
          양식명
          <input value={props.templateName} onChange={(event) => props.setTemplateName(event.target.value)} placeholder="예: 주간 회의록" />
        </label>
        <label>
          설명
          <input
            value={props.templateDescription}
            onChange={(event) => props.setTemplateDescription(event.target.value)}
            placeholder="예: 주간 회의용"
          />
        </label>
        <label>
          파일
          <FilePicker
            accept=".doc,application/msword"
            key={props.editingTemplateId || "new-template"}
            helperText={props.editingTemplateId ? "새 파일 선택" : "파일 업로드"}
            onChange={props.setTemplateFile}
          />
        </label>
        <div className="form-actions">
          <button className="primary" type="submit">
            {props.editingTemplateId ? "수정" : "업로드"}
          </button>
          {props.editingTemplateId && (
            <button className="secondary" type="button" onClick={props.resetTemplateForm}>
              취소
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function TemplateListItem(props: {
  template: Template;
  updateTemplate: (templateId: string, name: string, description: string, file: File | null) => Promise<void>;
  deleteTemplate: (templateId: string) => void;
}) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [name, setName] = React.useState(props.template.name);
  const [description, setDescription] = React.useState(props.template.description || "");
  const [file, setFile] = React.useState<File | null>(null);

  function cancelEdit() {
    setName(props.template.name);
    setDescription(props.template.description || "");
    setFile(null);
    setIsEditing(false);
  }

  async function saveEdit() {
    await props.updateTemplate(props.template.id, name, description, file);
    setFile(null);
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <article className="template-card template-card-editing">
        <div className="template-inline-form">
          <label className="inline-edit-field">
            양식명
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="예: 주간 회의록" />
          </label>
          <label className="inline-edit-field">
            설명
            <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="예: 주간 회의용" />
          </label>
          <label className="inline-edit-field">
            파일
            <FilePicker accept=".doc,application/msword" helperText="새 파일 선택" onChange={setFile} />
          </label>
          <span>{props.template.original_filename}</span>
        </div>
        <div className="card-actions">
          <button className="secondary compact-text-button" type="button" onClick={saveEdit}>
            저장
          </button>
          <button className="secondary compact-text-button" type="button" onClick={cancelEdit}>
            취소
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="template-card">
      <div>
        <strong>{props.template.name}</strong>
        <p>{props.template.description || "설명 없음"}</p>
        <span>{props.template.original_filename}</span>
      </div>
      <div className="card-actions">
        <button className="secondary compact-text-button" type="button" onClick={() => setIsEditing(true)}>
          수정
        </button>
        <a className="icon-button add-attendee" title="양식 다운로드" href={`${API_BASE}/api/v1/meeting-templates/${props.template.id}/download`}>
          <Download size={18} />
        </a>
        <button className="danger-button" title="양식 삭제" type="button" onClick={() => props.deleteTemplate(props.template.id)}>
          <Trash2 size={18} />
        </button>
      </div>
    </article>
  );
}
