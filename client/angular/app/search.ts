export type SearchField = "name" | "author" | "podUrl" | "magnetUri";

export interface Search {
  field: SearchField;
  value: string;
}
