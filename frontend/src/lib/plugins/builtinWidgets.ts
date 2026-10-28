import type { WidgetT } from "~/components/types";

export const builtinWidgets: Record<string, Partial<WidgetT>> = {
  rich_note: {
    name: "Markdown Note",
    description:
      "Create a markdown text widget for notes, documentation, or text content",
    category: "Utilities",
    connectionType: "widgetMetadata",
    params: [
      {
        paramName: "content",
        description: "The text content for the note",
        type: "text",
        value: "# New Note",
      },
      {
        paramName: "name",
        description: "A short title for the note",
        type: "text",
        value: "Note",
      },
      {
        paramName: "description",
        description: "A description of the note",
        type: "text",
        value: "A note widget",
      },
    ],
  },
  clock: {
    name: "Clock",
    description: "Display the time from various timezones",
    category: "Utilities",
    gridData: { w: 20, h: 4 },
    disableRetrievalForCopilot: true,
  },
  navigation_bar: {
    name: "Navigation Bar",
    description: "Create nested tabs inside an app for navigation.",
    category: "Utilities",
    gridData: { w: 40, h: 2, minW: 40, maxH: 2, minH: 2 },
    disableRetrievalForCopilot: true,
  },
  rss_viewer: {
    name: "RSS / Atom Feed",
    description: "View and manage RSS feeds",
    category: "Utilities",
    connectionType: "widgetMetadata",
  },
  iframe: {
    name: "Iframe",
    description: "Embed a webpage",
    category: "Utilities",
    connectionType: "widgetMetadata",
  },
  youtube: {
    name: "YouTube",
    description: "Embed a YouTube video",
    category: "Utilities",
    connectionType: "widgetMetadata",
  },
};
