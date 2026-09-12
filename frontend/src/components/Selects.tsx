import React from "react";
import { ChevronDown } from "lucide-react";

import type { Project, Template } from "../types";

const SELECT_MENU_MAX_HEIGHT = 260;
const SELECT_MENU_GAP = 8;
const VIEWPORT_PADDING = 16;

type DropdownPlacement = "down" | "up";

function useDropdownPlacement(isOpen: boolean) {
  const selectRef = React.useRef<HTMLDivElement | null>(null);
  const [placement, setPlacement] = React.useState<DropdownPlacement>("down");
  const [maxHeight, setMaxHeight] = React.useState(SELECT_MENU_MAX_HEIGHT);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    function updatePlacement() {
      const rect = selectRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }
      const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PADDING - SELECT_MENU_GAP;
      const spaceAbove = rect.top - VIEWPORT_PADDING - SELECT_MENU_GAP;
      const shouldOpenUp = spaceBelow < SELECT_MENU_MAX_HEIGHT && spaceAbove > spaceBelow;
      const availableSpace = shouldOpenUp ? spaceAbove : spaceBelow;
      setPlacement(shouldOpenUp ? "up" : "down");
      setMaxHeight(Math.max(120, Math.min(SELECT_MENU_MAX_HEIGHT, availableSpace)));
    }

    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    return () => {
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [isOpen]);

  return { selectRef, placement, maxHeight };
}

function menuClassName(placement: DropdownPlacement) {
  return placement === "up" ? "select-menu open-up" : "select-menu";
}

export function TemplateSelect(props: {
  templates: Template[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const selectedTemplate = props.templates.find((template) => template.id === props.value);
  const { selectRef, placement, maxHeight } = useDropdownPlacement(isOpen);

  React.useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!selectRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  return (
    <div className="custom-select" ref={selectRef}>
      <button
        type="button"
        className={`select-trigger ${isOpen ? "open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className={selectedTemplate ? "" : "placeholder"}>
          {selectedTemplate ? selectedTemplate.name : "양식을 선택하세요"}
        </span>
        <ChevronDown size={18} />
      </button>

      {isOpen && (
        <div className={menuClassName(placement)} role="listbox" style={{ maxHeight }}>
          {props.templates.length === 0 ? (
            <div className="select-empty">등록된 양식이 없습니다.</div>
          ) : (
            props.templates.map((template) => (
              <button
                type="button"
                className={`select-option ${template.id === props.value ? "selected" : ""}`}
                key={template.id}
                role="option"
                aria-selected={template.id === props.value}
                onClick={() => {
                  props.onChange(template.id);
                  setIsOpen(false);
                }}
              >
                <strong>{template.name}</strong>
                <span>{template.description || template.original_filename}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function ProjectSelect(props: {
  projects: Project[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const selectedProject = props.projects.find((project) => project.id === props.value);
  const { selectRef, placement, maxHeight } = useDropdownPlacement(isOpen);

  React.useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!selectRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  return (
    <div className="custom-select" ref={selectRef}>
      <button
        type="button"
        className={`select-trigger ${isOpen ? "open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className={selectedProject ? "" : "placeholder"}>
          {selectedProject ? selectedProject.name : "프로젝트를 선택하세요"}
        </span>
        <ChevronDown size={18} />
      </button>

      {isOpen && (
        <div className={menuClassName(placement)} role="listbox" style={{ maxHeight }}>
          {props.projects.length === 0 ? (
            <div className="select-empty">등록된 프로젝트가 없습니다.</div>
          ) : (
            props.projects.map((project) => (
              <button
                type="button"
                className={`select-option ${project.id === props.value ? "selected" : ""}`}
                key={project.id}
                role="option"
                aria-selected={project.id === props.value}
                onClick={() => {
                  props.onChange(project.id);
                  setIsOpen(false);
                }}
              >
                <strong>{project.name}</strong>
                <span>{project.description || "설명 없음"}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function SimpleSelect(props: {
  placeholder: string;
  options: string[];
  value: string;
  emptyText?: string;
  disabledOptions?: string[];
  disabledReason?: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const { selectRef, placement, maxHeight } = useDropdownPlacement(isOpen);
  const disabledOptions = new Set(props.disabledOptions ?? []);

  React.useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!selectRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  return (
    <div className="custom-select simple-select" ref={selectRef}>
      <button
        type="button"
        className={`select-trigger ${isOpen ? "open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className={props.value ? "" : "placeholder"}>{props.value || props.placeholder}</span>
        <ChevronDown size={18} />
      </button>

      {isOpen && (
        <div className={menuClassName(placement)} role="listbox" style={{ maxHeight }}>
          {props.options.length === 0 ? (
            <div className="select-empty">{props.emptyText || "선택할 항목이 없습니다."}</div>
          ) : props.options.map((option) => {
            const isDisabled = disabledOptions.has(option);
            return (
              <button
                type="button"
                className={`select-option simple-option ${option === props.value ? "selected" : ""} ${isDisabled ? "disabled" : ""}`}
                disabled={isDisabled}
                key={option}
                role="option"
                aria-selected={option === props.value}
                onClick={() => {
                  props.onChange(option);
                  setIsOpen(false);
                }}
              >
                <strong>{option}</strong>
                {isDisabled && props.disabledReason && <span>{props.disabledReason}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function CheckboxSelect(props: {
  placeholder: string;
  options: string[];
  selectedOptions: string[];
  emptyText?: string;
  disabledOptions?: string[];
  disabledReason?: string;
  onToggle: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const { selectRef, placement, maxHeight } = useDropdownPlacement(isOpen);
  const selectedOptions = new Set(props.selectedOptions);
  const disabledOptions = new Set(props.disabledOptions ?? []);
  const valueLabel = props.selectedOptions.length ? props.selectedOptions.join(", ") : props.placeholder;

  React.useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!selectRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [selectRef]);

  return (
    <div className="custom-select simple-select" ref={selectRef}>
      <button
        type="button"
        className={`select-trigger ${isOpen ? "open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className={props.selectedOptions.length ? "" : "placeholder"}>{valueLabel}</span>
        <ChevronDown size={18} />
      </button>

      {isOpen && (
        <div className={menuClassName(placement)} role="listbox" style={{ maxHeight }}>
          {props.options.length === 0 ? (
            <div className="select-empty">{props.emptyText || "선택할 항목이 없습니다."}</div>
          ) : props.options.map((option) => {
            const checked = selectedOptions.has(option);
            const disabled = !checked && disabledOptions.has(option);
            return (
              <label
                className={`select-option simple-option checkbox-option ${checked ? "selected" : ""} ${disabled ? "disabled" : ""}`}
                key={option}
                role="option"
                aria-selected={checked}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => props.onToggle(option)}
                />
                <strong>{option}</strong>
                {disabled && props.disabledReason && <span>{props.disabledReason}</span>}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
