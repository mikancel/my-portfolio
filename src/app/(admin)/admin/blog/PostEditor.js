"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./editor.module.css";

// ---- TagSelector ----

function TagSelector({ selected, onChange }) {
  const [allTags, setAllTags] = useState([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    fetch("/api/blog?all=1&limit=1")
      .then(r => r.json())
      .then(d => setAllTags(d.tags || []));
  }, []);

  const toggle = (name) => {
    if (selected.includes(name)) {
      onChange(selected.filter(t => t !== name));
    } else {
      onChange([...selected, name]);
    }
  };

  const addNew = () => {
    const name = input.trim();
    if (!name || selected.includes(name)) { setInput(""); return; }
    onChange([...selected, name]);
    setInput("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); addNew(); }
  };

  return (
    <div className={styles.tagSelector}>
      {/* 選択済みバッジ */}
      {selected.length > 0 && (
        <div className={styles.tagBadges}>
          {selected.map(name => (
            <span key={name} className={styles.tagBadge}>
              {name}
              <button
                type="button"
                className={styles.tagBadgeRemove}
                onClick={() => onChange(selected.filter(t => t !== name))}
              >×</button>
            </span>
          ))}
        </div>
      )}

      {/* 既存タグ一覧 */}
      {allTags.length > 0 && (
        <div className={styles.tagExisting}>
          {allTags.map(t => (
            <button
              key={t.id}
              type="button"
              className={`${styles.tagExistingBtn} ${selected.includes(t.name) ? styles.tagExistingBtnActive : ""}`}
              onClick={() => toggle(t.name)}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      {/* 新規タグ入力 */}
      <div className={styles.tagNewRow}>
        <input
          className={styles.tagNewInput}
          placeholder="新しいタグ名"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className={styles.tagNewBtn}
          onClick={addNew}
          disabled={!input.trim()}
        >追加</button>
      </div>
    </div>
  );
}

// ---- PostEditor ----

const TOOLBAR = [
  { label: "B", wrap: ["**", "**"], title: "太字 (Ctrl+B)" },
  { label: "I", wrap: ["*", "*"], title: "斜体 (Ctrl+I)" },
  { label: "~~", wrap: ["~~", "~~"], title: "打ち消し" },
  { label: "`", wrap: ["`", "`"], title: "インラインコード (Ctrl+K)" },
  { label: "```", insert: "\n```\n\n```\n", title: "コードブロック" },
  { label: "H1", insert: "\n# ", title: "見出し1" },
  { label: "H2", insert: "\n## ", title: "見出し2" },
  { label: "H3", insert: "\n### ", title: "見出し3" },
  { label: ">", insert: "\n> ", title: "引用" },
  { label: "---", insert: "\n---\n", title: "水平線" },
];

export default function PostEditor({ postId: initialPostId }) {
  const [postId, setPostId] = useState(initialPostId || null);
  const isEdit = !!initialPostId;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState([]);
  const [thumbnail, setThumbnail] = useState("");
  const [published, setPublished] = useState(false);
  const [preview, setPreview] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [tab, setTab] = useState("write");
  const textareaRef = useRef(null);
  const previewDebounce = useRef(null);
  const fileInputRef = useRef(null);
  const thumbInputRef = useRef(null);

  useEffect(() => {
    if (!isEdit) return;
    fetch(`/api/blog/${initialPostId}?all=1`).then(r => r.json()).then(data => {
      if (data.error) return;
      setTitle(data.title || "");
      setContent(data.content || "");
      setTags(data.tags?.map(t => t.name) || []);
      setThumbnail(data.thumbnail || "");
      setPublished(data.published || false);
    });
  }, [initialPostId, isEdit]);

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

  const ensurePostId = useCallback(async () => {
    if (postId) return postId;
    if (!title.trim()) {
      setMessage({ type: "error", text: "タイトルを入力してください" });
      return null;
    }
    const res = await fetch("/api/blog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, thumbnail: thumbnail || null, published: false, tagNames: tags }),
    });
    const data = await res.json();
    if (data.error) {
      setMessage({ type: "error", text: data.error });
      return null;
    }
    setPostId(data.id);
    // router.replace だとコンポーネントが再マウントされ編集中の内容が失われるため、
    // URLだけ差し替える
    window.history.replaceState(null, "", `/admin/blog/${data.id}/edit`);
    return data.id;
  }, [postId, title, content, tags, thumbnail]);

  async function compressImage(file) {
    if (file.type === "image/gif") return { blob: file, contentType: "image/gif", filename: file.name };

    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null); // 読み込めない画像はスキップ
      };
      img.onload = () => {
        URL.revokeObjectURL(url);
        const maxSize = 1920;
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const limit = 4.5 * 1024 * 1024;
        // 1.0はエンコードが極端に重くサイズも肥大するため0.85から開始（体感差ほぼなし）
        const qualities = [0.85, 0.7, 0.5];
        const filename = file.name.replace(/\.[^.]+$/, ".webp");

        const tryCompress = (i) => {
          canvas.toBlob((blob) => {
            if (blob.size <= limit || i === qualities.length - 1) {
              resolve({ blob, contentType: "image/webp", filename });
            } else {
              tryCompress(i + 1);
            }
          }, "image/webp", qualities[i]);
        };

        tryCompress(0);
      };
      img.src = url;
    });
  }

  const insertAtCursor = useCallback((text) => {
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
  }, [content]);

  const wrapText = useCallback((before, after) => {
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
  }, [content]);

  const uploadFiles = useCallback(async (files, isThumbnail = false) => {
    const id = await ensurePostId();
    if (!id) return;
    setUploading(true);
    for (const file of files) {
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) continue;

      let uploadBlob = file;
      let uploadContentType = file.type;
      let uploadFilename = file.name;

      if (file.type.startsWith("image/")) {
        const compressed = await compressImage(file);
        if (!compressed) {
          setMessage({ type: "error", text: `${file.name} を読み込めませんでした` });
          continue;
        }
        if (compressed.blob.size > 4.5 * 1024 * 1024) {
          setMessage({ type: "error", text: `${file.name} は圧縮後も4.5MBを超えています` });
          continue;
        }
        uploadBlob = compressed.blob;
        uploadContentType = compressed.contentType;
        uploadFilename = compressed.filename;
      } else if (file.size > 4.5 * 1024 * 1024) {
        setMessage({ type: "error", text: `${file.name} は4.5MB以上のため、アップロードできません` });
        continue;
      }

      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: uploadFilename,
          contentType: uploadContentType,
          postId: id,
          isThumbnail,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setMessage({ type: "error", text: data.error });
        continue;
      }

      const putRes = await fetch(data.url, {
        method: "PUT",
        headers: { "Content-Type": uploadContentType },
        body: uploadBlob,
      });
      if (!putRes.ok) {
        setMessage({ type: "error", text: "アップロードに失敗しました" });
        continue;
      }

      if (isThumbnail) {
        setThumbnail(data.publicUrl);
        setMessage({ type: "success", text: "サムネイルを設定しました" });
      } else {
        const tag = file.type.startsWith("video/")
          ? `\n<video src="${data.publicUrl}" controls></video>\n`
          : `\n![](${data.publicUrl})\n`;
        insertAtCursor(tag);
      }
    }
    setUploading(false);
  }, [ensurePostId, insertAtCursor]);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files || []);
    await uploadFiles(files);
  }, [uploadFiles]);

  const handleDragOver = (e) => e.preventDefault();

  const handleFileSelect = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    await uploadFiles(files);
    e.target.value = "";
  }, [uploadFiles]);

  const handleKeyDown = (e) => {
    const isMac = navigator.platform.toUpperCase().includes("MAC");
    const mod = isMac ? e.metaKey : e.ctrlKey;
    if (!mod) return;
    const shortcuts = {
      b: ["**", "**"],
      i: ["*", "*"],
      k: ["`", "`"],
    };
    const pair = shortcuts[e.key.toLowerCase()];
    if (pair) {
      e.preventDefault();
      wrapText(pair[0], pair[1]);
    }
  };

  const handleSave = async (pub = published) => {
    if (!title.trim()) {
      setMessage({ type: "error", text: "タイトルを入力してください" });
      return;
    }
    setSaving(true);
    setMessage({ type: "", text: "" });

    const body = { title, content, thumbnail: thumbnail || null, published: pub, tagNames: tags };
    const currentId = postId;
    const url = currentId ? `/api/blog/${currentId}` : "/api/blog";
    const method = currentId ? "PATCH" : "POST";

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
      if (!currentId) {
        setPostId(data.id);
        window.history.replaceState(null, "", `/admin/blog/${data.id}/edit`);
      }
    }
  };

  return (
    <div className={styles.editor}>
      <input
        className={styles.titleInput}
        placeholder="記事タイトル"
        value={title}
        onChange={e => setTitle(e.target.value)}
      />

      <div className={styles.metaRow}>
        <TagSelector selected={tags} onChange={setTags} />
        <div className={styles.thumbnailRow}>
          {thumbnail && (
            <img src={thumbnail} alt="thumbnail" className={styles.thumbnailPreview} />
          )}
          <button
            className={styles.thumbnailBtn}
            onClick={() => thumbInputRef.current?.click()}
            disabled={uploading}
            type="button"
          >
            {thumbnail ? "変更" : "サムネイル設定"}
          </button>
          {thumbnail && (
            <button
              className={styles.thumbnailRemoveBtn}
              onClick={() => setThumbnail("")}
              type="button"
            >
              削除
            </button>
          )}
          <input
            ref={thumbInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              uploadFiles(files, true);
              e.target.value = "";
            }}
          />
        </div>
      </div>

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

      {tab === "write" && (
        <div className={styles.toolbar}>
          {TOOLBAR.map(t => (
            <button
              key={t.label}
              className={styles.toolBtn}
              onClick={() => (t.wrap ? wrapText(t.wrap[0], t.wrap[1]) : insertAtCursor(t.insert))}
              title={t.title}
            >
              {t.label}
            </button>
          ))}
          <button
            className={styles.toolBtn}
            onClick={() => fileInputRef.current?.click()}
            title="画像・動画を挿入"
            disabled={uploading}
          >
            {uploading ? "..." : "🖼"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            style={{ display: "none" }}
            onChange={handleFileSelect}
          />
        </div>
      )}

      {tab === "write" ? (
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          placeholder="Markdownで記事を書く...&#10;&#10;画像・動画はここにドラッグ＆ドロップできます"
          value={content}
          onChange={e => setContent(e.target.value)}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onKeyDown={handleKeyDown}
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