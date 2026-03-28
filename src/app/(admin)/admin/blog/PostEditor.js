"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import styles from "./editor.module.css";

export default function PostEditor({ postId }) {
  const router = useRouter();
  const isEdit = !!postId;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState(""); // comma separated
  const [thumbnail, setThumbnail] = useState("");
  const [published, setPublished] = useState(false);
  const [preview, setPreview] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [tab, setTab] = useState("write"); // write | preview
  const textareaRef = useRef(null);
  const previewDebounce = useRef(null);

  // 初期ロード（編集時）
  useEffect(() => {
    if (!isEdit) return;
    fetch(`/api/blog/${postId}?all=1`).then(r => r.json()).then(data => {
      if (data.error) return;
      setTitle(data.title || "");
      setContent(data.content || "");
      setTags(data.tags?.map(t => t.name).join(", ") || "");
      setThumbnail(data.thumbnail || "");
      setPublished(data.published || false);
    });
  }, [postId, isEdit]);

  // プレビュー更新（debounce）
  const refreshPreview = useCallback(async (md) => {
    if (!md) { setPreview(""); return; }
    setPreviewLoading(true);
    const res = await fetch("/api/blog/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: md }),
    });
    const data = await res.json();
    setPreview(data.html || "");
    setPreviewLoading(false);
  }, []);

  useEffect(() => {
    if (tab !== "preview") return;
    clearTimeout(previewDebounce.current);
    previewDebounce.current = setTimeout(() => refreshPreview(content), 400);
    return () => clearTimeout(previewDebounce.current);
  }, [content, tab, refreshPreview]);

  // 画像ドロップ
  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files || []);
    for (const file of files) {
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) continue;
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) {
        const tag = file.type.startsWith("video/")
          ? `\n<video src="${data.url}" controls></video>\n`
          : `\n![${file.name}](${data.url})\n`;
        insertAtCursor(tag);
      }
    }
  }, []);

  const handleDragOver = (e) => e.preventDefault();

  function insertAtCursor(text) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newVal = content.slice(0, start) + text + content.slice(end);
    setContent(newVal);
    setTimeout(() => {
      ta.selectionStart = ta.selectionEnd = start + text.length;
      ta.focus();
    }, 0);
  }

  // ツールバー操作
  const toolbar = [
    { label: "B", action: () => wrapText("**", "**"), title: "太字" },
    { label: "I", action: () => wrapText("*", "*"), title: "斜体" },
    { label: "~~", action: () => wrapText("~~", "~~"), title: "打ち消し" },
    { label: "`", action: () => wrapText("`", "`"), title: "インラインコード" },
    { label: "```", action: () => insertAtCursor("\n```\n\n```\n"), title: "コードブロック" },
    { label: "H2", action: () => insertAtCursor("\n## "), title: "見出し2" },
    { label: "H3", action: () => insertAtCursor("\n### "), title: "見出し3" },
    { label: ">", action: () => insertAtCursor("\n> "), title: "引用" },
    { label: "---", action: () => insertAtCursor("\n---\n"), title: "水平線" },
  ];

  function wrapText(before, after) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = content.slice(start, end);
    const newVal = content.slice(0, start) + before + selected + after + content.slice(end);
    setContent(newVal);
    setTimeout(() => {
      ta.selectionStart = start + before.length;
      ta.selectionEnd = end + before.length;
      ta.focus();
    }, 0);
  }

  // 画像URL挿入
  const handleImageUrl = async () => {
    const url = prompt("画像URLを入力:");
    if (url) insertAtCursor(`\n![画像](${url})\n`);
  };

  // 保存
  const handleSave = async (pub = published) => {
    if (!title.trim()) {
      setMessage({ type: "error", text: "タイトルを入力してください" });
      return;
    }
    setSaving(true);
    setMessage({ type: "", text: "" });

    const tagNames = tags
      .split(",")
      .map(t => t.trim())
      .filter(Boolean);

    const body = { title, content, thumbnail: thumbnail || null, published: pub, tagNames };
    const url = isEdit ? `/api/blog/${postId}` : "/api/blog";
    const method = isEdit ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);

    if (data.error) {
      setMessage({ type: "error", text: data.error });
    } else {
      setMessage({ type: "success", text: pub ? "公開しました！" : "下書きを保存しました" });
      setPublished(pub);
      if (!isEdit) {
        setTimeout(() => router.replace(`/admin/blog/${data.id}/edit`), 800);
      }
    }
  };

  return (
    <div className={styles.editor}>
      {/* タイトル */}
      <input
        className={styles.titleInput}
        placeholder="記事タイトル"
        value={title}
        onChange={e => setTitle(e.target.value)}
      />

      {/* メタ情報行 */}
      <div className={styles.metaRow}>
        <input
          className={styles.metaInput}
          placeholder="タグ（カンマ区切り）例: Next.js, React"
          value={tags}
          onChange={e => setTags(e.target.value)}
        />
        <input
          className={styles.metaInput}
          placeholder="サムネイルURL（任意）"
          value={thumbnail}
          onChange={e => setThumbnail(e.target.value)}
        />
      </div>

      {/* タブ切り替え */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === "write" ? styles.tabActive : ""}`}
          onClick={() => setTab("write")}
        >
          編集
        </button>
        <button
          className={`${styles.tab} ${tab === "preview" ? styles.tabActive : ""}`}
          onClick={() => setTab("preview")}
        >
          プレビュー
        </button>
      </div>

      {/* ツールバー */}
      {tab === "write" && (
        <div className={styles.toolbar}>
          {toolbar.map(t => (
            <button
              key={t.label}
              className={styles.toolBtn}
              onClick={t.action}
              title={t.title}
            >
              {t.label}
            </button>
          ))}
          <button className={styles.toolBtn} onClick={handleImageUrl} title="画像URL挿入">
            🖼
          </button>
        </div>
      )}

      {/* エディタ本体 */}
      {tab === "write" ? (
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          placeholder="Markdownで記事を書く...&#10;&#10;画像・動画はここにドラッグ＆ドロップできます"
          value={content}
          onChange={e => setContent(e.target.value)}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        />
      ) : (
        <div className={styles.previewPane}>
          {previewLoading ? (
            <div className={styles.previewLoading}>レンダリング中...</div>
          ) : (
            <div
              className={styles.previewContent}
              dangerouslySetInnerHTML={{ __html: preview }}
            />
          )}
        </div>
      )}

      {/* フッター操作 */}
      <div className={styles.footer}>
        <div className={styles.footerLeft}>
          {message.text && (
            <span className={message.type === "error" ? styles.msgError : styles.msgSuccess}>
              {message.text}
            </span>
          )}
        </div>
        <div className={styles.footerRight}>
          <button
            className={styles.draftBtn}
            onClick={() => handleSave(false)}
            disabled={saving}
          >
            {saving ? "保存中..." : "下書き保存"}
          </button>
          <button
            className={styles.publishBtn}
            onClick={() => handleSave(true)}
            disabled={saving}
          >
            {published ? "更新する" : "公開する"}
          </button>
        </div>
      </div>
    </div>
  );
}
