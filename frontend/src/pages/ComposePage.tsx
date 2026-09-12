import React from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";

import type { CompanyAttendees, MeetingType, Project, Template, TitleMode } from "../types";
import { DateTimePicker } from "../components/DateTimePicker";
import { FilePicker } from "../components/FilePicker";
import { CheckboxSelect, ProjectSelect, SimpleSelect, TemplateSelect } from "../components/Selects";

export function ComposePage(props: {
  templates: Template[];
  projects: Project[];
  selectedProject: Project | null;
  selectedProjectId: string;
  setSelectedProjectId: (value: string) => void;
  selectedTemplateId: string;
  setSelectedTemplateId: (value: string) => void;
  setTranscriptFile: (file: File | null) => void;
  meetingDatetime: string;
  setMeetingDatetime: (value: string) => void;
  location: string;
  setLocation: (value: string) => void;
  author: string;
  setAuthor: (value: string) => void;
  meetingType: MeetingType;
  setMeetingType: (value: MeetingType) => void;
  attendees: CompanyAttendees[];
  setAttendees: (value: CompanyAttendees[]) => void;
  draggedAttendeeIndex: number | null;
  setDraggedAttendeeIndex: (value: number | null) => void;
  attendeeDropIndex: number | null;
  setAttendeeDropIndex: (value: number | null) => void;
  titleMode: TitleMode;
  setTitleMode: (value: TitleMode) => void;
  manualTitle: string;
  setManualTitle: (value: string) => void;
  isGenerating: boolean;
  createDraft: (event: React.FormEvent) => void;
}) {
  const authorOptions = props.selectedProject?.attendees.length
    ? props.selectedProject.attendees
    : getSelectedAttendeeNames(props.attendees);

  return (
    <form className="workspace" onSubmit={props.createDraft}>
      <section className="panel">
        <h2>기본 정보</h2>
        <div className="form-grid">
          <label>
            프로젝트
            <ProjectSelect
              projects={props.projects}
              value={props.selectedProjectId}
              onChange={props.setSelectedProjectId}
            />
          </label>
          <label>
            회의록 양식
            <TemplateSelect
              templates={props.templates}
              value={props.selectedTemplateId}
              onChange={props.setSelectedTemplateId}
            />
          </label>
          <label>
            txt 파일
            <FilePicker accept=".txt,text/plain" helperText="파일 업로드" onChange={props.setTranscriptFile} />
          </label>
          <label>
            회의 일시
            <DateTimePicker value={props.meetingDatetime} onChange={props.setMeetingDatetime} />
          </label>
          <label>
            회의 장소
            {props.selectedProject?.locations.length ? (
              <SimpleSelect
                placeholder="회의 장소를 선택하세요"
                options={props.selectedProject.locations}
                value={props.location}
                onChange={props.setLocation}
              />
            ) : (
              <input value={props.location} onChange={(event) => props.setLocation(event.target.value)} placeholder="예: 본사 7층 회의실" />
            )}
          </label>
          <label>
            작성자
            <SimpleSelect
              placeholder="작성자를 선택하세요"
              emptyText={props.selectedProject ? "등록된 참석자가 없습니다." : "참석자를 먼저 추가하세요"}
              options={authorOptions}
              value={props.author}
              onChange={props.setAuthor}
            />
          </label>
        </div>

        <div className="inline-section">
          <div className="option-grid">
            <div className="option-block">
              <h3>회의 형식</h3>
              <div className="segmented full-width">
                <button type="button" className={props.meetingType === "in_person" ? "selected" : ""} onClick={() => props.setMeetingType("in_person")}>
                  대면
                </button>
                <button type="button" className={props.meetingType === "remote" ? "selected" : ""} onClick={() => props.setMeetingType("remote")}>
                  비대면
                </button>
              </div>
            </div>

            <div className="option-block">
              <h3>제목</h3>
              <fieldset>
                <div className="segmented full-width">
                  <button type="button" className={props.titleMode === "ai" ? "selected" : ""} onClick={() => props.setTitleMode("ai")}>
                    AI 추천
                  </button>
                  <button type="button" className={props.titleMode === "manual" ? "selected" : ""} onClick={() => props.setTitleMode("manual")}>
                    직접 입력
                  </button>
                </div>
              </fieldset>
              {props.titleMode === "manual" && (
                <label className="manual-title-field">
                  회의록 제목
                  <input value={props.manualTitle} onChange={(event) => props.setManualTitle(event.target.value)} placeholder="제목" />
                </label>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="panel compose-attendee-panel">
        <div className="panel-heading">
          <div>
            <h2>참석자</h2>
            <p>회사명과 참석자를 행 단위로 입력합니다. 입력한 행 순서대로 회의록에 반영됩니다.</p>
          </div>
          <button
            type="button"
            className="icon-button add-attendee"
            title="참석자 행 추가"
            onClick={() => props.setAttendees([...props.attendees, { company: "", attendeesText: "" }])}
          >
            <Plus size={18} />
          </button>
        </div>
        <div
          className="attendee-list"
          onDragOver={(event) => {
            if (props.draggedAttendeeIndex !== null) {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (props.draggedAttendeeIndex !== null) {
              moveAttendee(props, props.draggedAttendeeIndex, props.attendeeDropIndex ?? props.attendees.length);
            }
            props.setDraggedAttendeeIndex(null);
            props.setAttendeeDropIndex(null);
          }}
        >
          {props.attendees.map((row, index) => (
            <React.Fragment key={index}>
              {props.attendeeDropIndex === index && <div className="drop-indicator" />}
              <div
                className={`attendee-row ${props.draggedAttendeeIndex === index ? "dragging" : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  const rect = event.currentTarget.getBoundingClientRect();
                  const isAfterRow = event.clientY > rect.top + rect.height / 2;
                  props.setAttendeeDropIndex(index + (isAfterRow ? 1 : 0));
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (props.draggedAttendeeIndex !== null) {
                    moveAttendee(props, props.draggedAttendeeIndex, props.attendeeDropIndex ?? index);
                  }
                  props.setDraggedAttendeeIndex(null);
                  props.setAttendeeDropIndex(null);
                }}
              >
                <button
                  type="button"
                  className="drag-handle"
                  title="드래그해서 순서 변경"
                  draggable
                  onDragStart={(event) => {
                    props.setDraggedAttendeeIndex(index);
                    props.setAttendeeDropIndex(index);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", String(index));
                  }}
                  onDragEnd={() => {
                    props.setDraggedAttendeeIndex(null);
                    props.setAttendeeDropIndex(null);
                  }}
                >
                  <GripVertical size={18} />
                </button>
                {props.selectedProject?.companies.length ? (
                  <SimpleSelect
                    placeholder="회사를 선택하세요"
                    options={props.selectedProject.companies}
                    value={row.company}
                    onChange={(value) => updateAttendee(props, index, "company", value)}
                  />
                ) : (
                  <input
                    value={row.company}
                    onChange={(event) => updateAttendee(props, index, "company", event.target.value)}
                    placeholder="회사명"
                  />
                )}
                {props.selectedProject?.attendees.length ? (
                  <CheckboxSelect
                    placeholder="참석자를 선택하세요"
                    options={props.selectedProject.attendees}
                    selectedOptions={parseAttendeeNames(row.attendeesText)}
                    disabledOptions={getSelectedAttendeeNames(props.attendees.filter((_, rowIndex) => rowIndex !== index))}
                    disabledReason="이미 추가되었습니다."
                    onToggle={(value) => toggleAttendeeNameInRow(props, index, value)}
                  />
                ) : (
                  <input
                    value={row.attendeesText}
                    onChange={(event) => updateAttendee(props, index, "attendeesText", event.target.value)}
                    placeholder="예시) OOO 대리, OOO 사원"
                  />
                )}
                <div className="attendee-controls">
                  <button
                    type="button"
                    className="icon-button attendee-remove"
                    title="참석자 행 삭제"
                    onClick={() => props.setAttendees(props.attendees.filter((_, rowIndex) => rowIndex !== index))}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            </React.Fragment>
          ))}
          {props.attendeeDropIndex === props.attendees.length && <div className="drop-indicator" />}
        </div>

        <div className="form-actions compose-submit">
          <button className="primary" type="submit" disabled={props.isGenerating}>
            {props.isGenerating ? "작성중입니다..." : "시작"}
          </button>
        </div>
      </section>
    </form>
  );
}

function updateAttendee(
  props: { attendees: CompanyAttendees[]; setAttendees: (value: CompanyAttendees[]) => void },
  index: number,
  field: keyof CompanyAttendees,
  value: string,
) {
  props.setAttendees(props.attendees.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)));
}

function toggleAttendeeNameInRow(
  props: { attendees: CompanyAttendees[]; setAttendees: (value: CompanyAttendees[]) => void },
  index: number,
  name: string,
) {
  const nextAttendees = [...props.attendees];
  const currentNames = parseAttendeeNames(nextAttendees[index].attendeesText);
  const nextNames = currentNames.includes(name) ? currentNames.filter((item) => item !== name) : [...currentNames, name];
  nextAttendees[index] = {
    ...nextAttendees[index],
    attendeesText: nextNames.join(", "),
  };
  props.setAttendees(nextAttendees);
}

function getSelectedAttendeeNames(attendees: CompanyAttendees[]) {
  return attendees.flatMap((row) => parseAttendeeNames(row.attendeesText));
}

function parseAttendeeNames(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function moveAttendee(
  props: { attendees: CompanyAttendees[]; setAttendees: (value: CompanyAttendees[]) => void },
  fromIndex: number,
  toIndex: number,
) {
  if (toIndex < 0 || toIndex > props.attendees.length || fromIndex === toIndex) {
    return;
  }

  const nextAttendees = [...props.attendees];
  const [movedRow] = nextAttendees.splice(fromIndex, 1);
  const adjustedIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
  nextAttendees.splice(adjustedIndex, 0, movedRow);
  props.setAttendees(nextAttendees);
}
