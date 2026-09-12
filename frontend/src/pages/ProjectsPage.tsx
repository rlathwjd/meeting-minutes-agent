import React from "react";
import { Plus, Trash2 } from "lucide-react";

import type { Project, Template } from "../types";

export function ProjectsPage(props: {
  projects: Project[];
  templates: Template[];
  projectName: string;
  setProjectName: (value: string) => void;
  projectDescription: string;
  setProjectDescription: (value: string) => void;
  projectTemplateIds: string[];
  toggleProjectTemplate: (templateId: string) => void;
  projectLocations: string[];
  setProjectLocations: (value: string[]) => void;
  projectLocationInput: string;
  setProjectLocationInput: (value: string) => void;
  projectCompanies: string[];
  setProjectCompanies: (value: string[]) => void;
  projectCompanyInput: string;
  setProjectCompanyInput: (value: string) => void;
  projectAttendees: string[];
  setProjectAttendees: (value: string[]) => void;
  projectAttendeeInput: string;
  setProjectAttendeeInput: (value: string) => void;
  editingProjectId: string | null;
  saveProject: (event: React.FormEvent) => void;
  editProject: (project: Project) => void;
  deleteProject: (projectId: string) => void;
  resetProjectForm: () => void;
}) {
  return (
    <div className="workspace two-column project-workspace">
      <section className="panel project-list-panel">
        <h2>프로젝트 목록</h2>
        <div className="project-list">
          {props.projects.length === 0 ? (
            <p className="empty">등록된 프로젝트가 없습니다.</p>
          ) : (
            props.projects.map((project) => (
              <article className="project-row" key={project.id}>
                <div>
                  <strong>{project.name}</strong>
                  <p>{project.description || "설명 없음"}</p>
                  <span>
                    회사 {project.companies.length}개 · 참석자 {project.attendees.length}명 · 회의 장소 {project.locations.length}개
                  </span>
                </div>
                <div className="card-actions">
                  <button className="secondary compact-text-button" type="button" onClick={() => props.editProject(project)}>
                    수정
                  </button>
                  <button className="danger-button" title="프로젝트 삭제" type="button" onClick={() => props.deleteProject(project.id)}>
                    <Trash2 size={18} />
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <form className="panel project-form-panel" onSubmit={props.saveProject}>
        <h2>{props.editingProjectId ? "프로젝트 수정" : "프로젝트 등록"}</h2>
        <div className="project-basic-row">
          <label>
            프로젝트명
            <input value={props.projectName} onChange={(event) => props.setProjectName(event.target.value)} placeholder="예: 키움증권 컨시어지" />
          </label>
          <label>
            설명
            <input
              value={props.projectDescription}
              onChange={(event) => props.setProjectDescription(event.target.value)}
              placeholder="예: 컨시어지 구축 프로젝트"
            />
          </label>
        </div>

        <div className="project-preset-stack">
          <EditablePresetList
            title="회사"
            placeholder="예: 키움증권"
            items={props.projectCompanies}
            setItems={props.setProjectCompanies}
            draft={props.projectCompanyInput}
            setDraft={props.setProjectCompanyInput}
          />
          <EditablePresetList
            title="참석자"
            placeholder="예: OOO 사원"
            items={props.projectAttendees}
            setItems={props.setProjectAttendees}
            draft={props.projectAttendeeInput}
            setDraft={props.setProjectAttendeeInput}
          />
          <EditablePresetList
            title="회의 장소"
            placeholder="예: 본사 7층 회의실"
            items={props.projectLocations}
            setItems={props.setProjectLocations}
            draft={props.projectLocationInput}
            setDraft={props.setProjectLocationInput}
          />
        </div>

        <div className="form-actions">
          <button className="primary" type="submit">
            {props.editingProjectId ? "수정" : "등록"}
          </button>
          {props.editingProjectId && (
            <button className="secondary" type="button" onClick={props.resetProjectForm}>
              취소
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function EditablePresetList(props: {
  title: string;
  placeholder: string;
  items: string[];
  setItems: (items: string[]) => void;
  draft: string;
  setDraft: (value: string) => void;
}) {
  const countLabel = `${props.items.length}${props.title === "참석자" ? "명" : "개"}`;

  function addItem() {
    const value = props.draft.trim();
    if (!value || props.items.includes(value)) {
      props.setDraft("");
      return;
    }
    props.setItems([...props.items, value]);
    props.setDraft("");
  }

  return (
    <section className="editable-preset">
      <div className="editable-preset-header">
        <strong>{props.title}</strong>
        <span>{countLabel}</span>
      </div>
      <div className="preset-add-row">
        <input
          value={props.draft}
          onChange={(event) => props.setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addItem();
            }
          }}
          placeholder={props.placeholder}
        />
        <button className="icon-button add-attendee" title={`${props.title} 추가`} type="button" onClick={addItem}>
          <Plus size={18} />
        </button>
      </div>
      {props.items.length > 0 && (
        <div className="editable-preset-chip-list">
          {props.items.map((item, index) => (
            <div className="editable-preset-chip" key={`${item}-${index}`}>
              <input
                aria-label={`${props.title} ${index + 1}`}
                value={item}
                onChange={(event) =>
                  props.setItems(props.items.map((current, itemIndex) => (itemIndex === index ? event.target.value : current)))
                }
              />
              <button
                className="danger-button"
                title={`${props.title} 삭제`}
                type="button"
                onClick={() => props.setItems(props.items.filter((_, itemIndex) => itemIndex !== index))}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
