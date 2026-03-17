"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ImageUploadProps {
  onImageSelected: (file: File, previewUrl: string) => void;
  previewUrl?: string;
}

export default function ImageUpload({
  onImageSelected,
  previewUrl,
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const url = URL.createObjectURL(file);
      onImageSelected(file, url);
    },
    [onImageSelected],
  );

  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) handleFile(file);
        }
      }
    }
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handleFile]);

  return (
    <div
      className={`relative flex flex-col items-center justify-center rounded-[18px] border-2 border-dashed p-8 transition-colors cursor-pointer ${
        dragOver
          ? "border-cyan-400 bg-cyan-400/5"
          : "border-[#364152] bg-[#0d1421] hover:border-[#4a5568]"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
      }}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      {previewUrl ? (
        <img
          src={previewUrl}
          alt="Uploaded"
          className="w-full rounded-xl object-contain"
        />
      ) : (
        <div className="text-center">
          <p className="text-lg text-[#8899b0]">
            Paste an image (Cmd+V) or click to upload
          </p>
          <p className="mt-2 text-sm text-[#5a6a80]">PNG, JPEG, or WebP</p>
        </div>
      )}
    </div>
  );
}
