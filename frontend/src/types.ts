export type View = "compose" | "result" | "templates" | "projects" | "minutes";
export type MeetingType = "in_person" | "remote";
export type TitleMode = "ai" | "manual";
export type Meridiem = "AM" | "PM";

export type Template = {
  project_id: string;
  template_data: { file?: { original_filename: string; size: number } };
  id: string;
  name: string;
  description: string;
  original_filename: string;
  size: number;
  created_at: string;
};

export type Project = {
  id: string;
  name: string;
  description: string;
  template_ids: string[];
  locations: string[];
  companies: string[];
  attendees: string[];
  created_at: string;
};

export type CompanyAttendees = {
  company: string;
  attendeesText: string;
};

export type GeneratedMinutes = {
  filename: string;
  url: string;
  previewUrl: string;
  size: number;
  mimeType: string;
  titleMode: TitleMode;
  title: string;
};

export type Toast = {
  id: number;
  view: View;
  message: string;
};

export type SavedMinute = {
  id: string; project_id: string; template_id: string | null; title: string;
  meeting_at: string | null; attendees: unknown[] | null; status: string; created_at: string; updated_at: string;
  content: { input?: Record<string, any>; transcript_text?: string; minutes?: Record<string, unknown>;
    document?: { filename: string; preview_url: string } };
};

export type ManagedMinute = SavedMinute & {
  project_name: string;
  template_name: string | null;
};
