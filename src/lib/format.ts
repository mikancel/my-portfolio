const THUMB_COLORS = [
  "#c4854a", "#7b9e6b", "#6b8fb5", "#9b7bb5",
  "#b5896b", "#6bb5a8", "#b56b7b", "#8fb56b",
  "#a07850", "#5b8c5a", "#4a7fa8", "#8a6aa8",
  "#c4956a", "#5aa898", "#a84a6b", "#7aa84a",
  "#d4956b", "#4a9e8b", "#8b4a9e", "#9e8b4a",
  "#6b9ed4", "#9ed46b", "#d46b9e", "#6bd4b5",
  "#d4a06b", "#6ba0d4", "#a0d46b", "#d46ba0",
  "#8b6bd4", "#6bd48b", "#d48b6b", "#6b8bd4",
  "#c47b7b", "#7bc47b", "#7b7bc4", "#c4b87b",
  "#7bc4b8", "#b87bc4", "#c4887b", "#7bc488",
];

// タイトル文字列からサムネイルのプレースホルダ色を決める
export function getColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return THUMB_COLORS[Math.abs(hash) % THUMB_COLORS.length];
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}
