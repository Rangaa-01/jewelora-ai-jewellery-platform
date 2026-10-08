"use client";

import { Box, ImagePlus, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import type { JewelleryType, ProductDetail } from "@/lib/api/types";
import { missingAnchors, type AnchorMap } from "@/lib/admin/anchors";
import { useDeleteAsset, useUploadAsset } from "@/lib/admin/hooks";
import { METAL_LABELS } from "@/lib/labels";
import { AnchorEditor } from "./anchor-editor";
import { Card, ConfirmDialog } from "./primitives";

const VIEWS = ["front", "left", "right", "top", "back", "angle"];
/** Catalogue photo views: angles plus close-up detail and the shop's own on-model shots. */
const IMAGE_VIEWS = [...VIEWS, "detail", "on_model"];
const VIEW_LABELS: Record<string, string> = {
  angle: "45° angle",
  detail: "detail / close-up",
  on_model: "on model",
};

function FilePicker({
  accept,
  onPick,
  label,
  hint,
  id,
}: {
  accept: string;
  onPick: (file: File) => void;
  label: string;
  hint: string;
  id: string;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <label
      htmlFor={id}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) onPick(f);
      }}
      className={`bg-bg-muted/50 focus-within:border-gold-deep flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center transition-colors ${dragging ? "border-gold-deep bg-gold/10" : "border-border-strong hover:border-gold"}`}
    >
      <Upload className="text-accent-text size-6" aria-hidden />
      <span className="mt-2 text-sm font-medium">{label}</span>
      <span className="text-fg-muted mt-1 text-xs">{hint}</span>
      <input
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
    </label>
  );
}

function variantOptions(product: ProductDetail) {
  return [
    { value: "", label: "All variants" },
    ...product.variants.map((v) => ({
      value: v.id,
      label: `${METAL_LABELS[v.metal_type]} ${v.purity ?? ""} (${v.sku_suffix})`,
    })),
  ];
}

export function ImagesPanel({ product }: { product: ProductDetail }) {
  const upload = useUploadAsset(product.id, "images");
  const remove = useDeleteAsset(product.id, "images");
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState({
    alt_text: "",
    view: "front",
    variant_id: "",
    is_primary: false,
  });
  const [deleting, setDeleting] = useState<string | null>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const submit = async () => {
    if (!file) return;
    try {
      await upload.mutateAsync({
        file,
        meta: {
          ...meta,
          variant_id: meta.variant_id || null,
          sort_order: product.images.length,
          alt_text: meta.alt_text || product.name,
        },
      });
      toast({ title: "Image uploaded", tone: "success" });
      setFile(null);
      setMeta({ alt_text: "", view: "front", variant_id: "", is_primary: false });
    } catch (error) {
      toast({ title: "Upload failed", description: errorMessage(error), tone: "error" });
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Add image">
        {file ? (
          <div className="flex flex-col gap-3">
            <div className="bg-bg-muted relative aspect-square max-h-64 overflow-hidden rounded-md">
              {preview && (
                <Image src={preview} alt="Preview" fill className="object-contain" unoptimized />
              )}
            </div>
            <Input
              label="Alt text"
              hint="Describe the image for screen readers."
              value={meta.alt_text}
              onChange={(e) => setMeta({ ...meta, alt_text: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="View"
                value={meta.view}
                onChange={(e) => setMeta({ ...meta, view: e.target.value })}
                options={IMAGE_VIEWS.map((v) => ({ value: v, label: VIEW_LABELS[v] ?? v }))}
              />
              <Select
                label="Variant"
                value={meta.variant_id}
                onChange={(e) => setMeta({ ...meta, variant_id: e.target.value })}
                options={variantOptions(product)}
              />
            </div>
            <Checkbox
              label="Use as the primary image"
              checked={meta.is_primary}
              onChange={(e) => setMeta({ ...meta, is_primary: e.target.checked })}
            />
            <div className="flex gap-2">
              <Button
                onClick={submit}
                loading={upload.isPending}
                leftIcon={<ImagePlus className="size-4" aria-hidden />}
              >
                Upload
              </Button>
              <Button variant="ghost" onClick={() => setFile(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <FilePicker
            id={`img-${product.id}`}
            accept="image/jpeg,image/png,image/webp"
            onPick={setFile}
            label="Choose or drop a product photo"
            hint="JPEG, PNG or WebP up to 25 MB. Converted to WebP on upload."
          />
        )}
      </Card>
      <Card title={`Images (${product.images.length})`}>
        {product.images.length === 0 ? (
          <p className="text-fg-muted text-sm">
            No images yet. The product card shows a placeholder until one is added.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {product.images.map((img) => (
              <li key={img.id} className="border-border relative overflow-hidden rounded-md border">
                <div className="bg-bg-muted relative aspect-square">
                  <Image
                    src={img.url}
                    alt={img.alt_text}
                    fill
                    sizes="200px"
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="flex items-center justify-between gap-1 p-2 text-xs">
                  <span className="truncate">
                    {img.view}
                    {img.is_primary && (
                      <Badge tone="gold" className="ml-1">
                        primary
                      </Badge>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDeleting(img.id)}
                    className="touch-target text-fg-muted hover:text-danger inline-flex items-center justify-center"
                    aria-label={`Delete ${img.view} image`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete this image?"
        description="This removes the file from storage."
        danger
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove.mutateAsync(deleting);
            toast({ title: "Image deleted", tone: "success" });
          } catch (error) {
            toast({ title: "Couldn't delete", description: errorMessage(error), tone: "error" });
          }
          setDeleting(null);
        }}
      />
    </div>
  );
}

export function TryOnAssetsPanel({ product }: { product: ProductDetail }) {
  const upload = useUploadAsset(product.id, "tryon-assets");
  const remove = useDeleteAsset(product.id, "tryon-assets");
  const { toast } = useToast();
  const type = product.jewellery_type as Exclude<JewelleryType, "set">;
  const supported = product.jewellery_type !== "set";
  const [file, setFile] = useState<File | null>(null);
  const [anchors, setAnchors] = useState<AnchorMap>({});
  const [meta, setMeta] = useState({
    view: "front",
    variant_id: "",
    real_width_mm: "",
    real_height_mm: "",
  });
  const [deleting, setDeleting] = useState<string | null>(null);
  const [autoCutout, setAutoCutout] = useState(false);
  const [singlePiece, setSinglePiece] = useState(false);
  const [punchHoles, setPunchHoles] = useState(false);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  // With auto cut-out the server estimates anchors from the outline; any placed anchors override.
  const missing = supported && !autoCutout ? missingAnchors(type, anchors) : [];

  const submit = async () => {
    if (!file) return;
    try {
      await upload.mutateAsync({
        file,
        autoCutout,
        meta: {
          view: meta.view,
          variant_id: meta.variant_id || null,
          anchors,
          real_width_mm: meta.real_width_mm || null,
          real_height_mm: meta.real_height_mm || null,
        },
      });
      toast({
        title: "Try-on asset uploaded",
        description: autoCutout
          ? "Background removed and anchors estimated. Review them in the list below."
          : "Customers can now try this piece on.",
        tone: "success",
      });
      setFile(null);
      setAnchors({});
    } catch (error) {
      toast({ title: "Upload failed", description: errorMessage(error), tone: "error" });
    }
  };

  if (!supported)
    return (
      <Card title="Try-on assets">
        <p className="text-fg-muted text-sm">
          Sets are tried on through their component pieces; add try-on assets to each component
          instead.
        </p>
      </Card>
    );

  return (
    <div className="flex flex-col gap-4">
      <Card title="Add try-on cut-out">
        {file && preview ? (
          <div className="flex flex-col gap-4">
            <div>
              <Checkbox
                label="Auto cut-out from a normal product photo"
                checked={autoCutout}
                onChange={(e) => setAutoCutout(e.target.checked)}
              />
              <p className="text-fg-muted mt-1 text-xs">
                Removes the background and estimates the anchors for you. Use it for ordinary studio
                photos; anchors you place still take priority.
              </p>
              {autoCutout && (
                <div className="mt-2 flex flex-col gap-1">
                  <Checkbox
                    label="Keep only the largest piece"
                    checked={singlePiece}
                    onChange={(e) => setSinglePiece(e.target.checked)}
                  />
                  <Checkbox
                    label="Re-open holes filled with backdrop (inside rings, loops of chain). Not for dark stones on a dark backdrop."
                    checked={punchHoles}
                    onChange={(e) => setPunchHoles(e.target.checked)}
                  />
                </div>
              )}
            </div>
            <AnchorEditor type={type} imageUrl={preview} anchors={anchors} onChange={setAnchors} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Select
                label="View"
                value={meta.view}
                onChange={(e) => setMeta({ ...meta, view: e.target.value })}
                options={VIEWS.map((v) => ({ value: v, label: v }))}
              />
              <Select
                label="Variant"
                value={meta.variant_id}
                onChange={(e) => setMeta({ ...meta, variant_id: e.target.value })}
                options={variantOptions(product)}
              />
              <Input
                label="Real width (mm)"
                type="number"
                inputMode="decimal"
                min={1}
                step="0.1"
                value={meta.real_width_mm}
                onChange={(e) => setMeta({ ...meta, real_width_mm: e.target.value })}
                hint="Improves scale on the customer."
              />
              <Input
                label="Real height (mm)"
                type="number"
                inputMode="decimal"
                min={1}
                step="0.1"
                value={meta.real_height_mm}
                onChange={(e) => setMeta({ ...meta, real_height_mm: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={submit} loading={upload.isPending} disabled={missing.length > 0}>
                Upload cut-out
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setFile(null);
                  setAnchors({});
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <FilePicker
            id={`tryon-${product.id}`}
            accept="image/png,image/webp,image/jpeg"
            onPick={setFile}
            label="Choose or drop a product photo or transparent PNG / WebP"
            hint="Front view. A transparent cut-out is used as is; a normal photo needs the 'auto cut-out' option."
          />
        )}
      </Card>
      <Card title={`Cut-outs (${product.tryon_assets.length})`}>
        {product.tryon_assets.length === 0 ? (
          <p className="text-fg-muted text-sm">
            No try-on assets yet, so “Try it on” is hidden for this product.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {product.tryon_assets.map((a) => (
              <li key={a.id} className="border-border overflow-hidden rounded-md border">
                <div className="relative aspect-square bg-[repeating-conic-gradient(#efe9df_0_25%,#e3dccf_0_50%)] bg-[length:16px_16px]">
                  <Image
                    src={a.url}
                    alt=""
                    fill
                    sizes="200px"
                    className="object-contain"
                    unoptimized
                  />
                </div>
                <div className="flex items-center justify-between gap-1 p-2 text-xs">
                  <span className="truncate">
                    {a.view} · {Object.keys(a.anchors).length} anchors
                    {a.real_width_mm && ` · ${a.real_width_mm} mm`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDeleting(a.id)}
                    className="touch-target text-fg-muted hover:text-danger inline-flex items-center justify-center"
                    aria-label="Delete try-on asset"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete this try-on asset?"
        danger
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove.mutateAsync(deleting);
            toast({ title: "Asset deleted", tone: "success" });
          } catch (error) {
            toast({ title: "Couldn't delete", description: errorMessage(error), tone: "error" });
          }
          setDeleting(null);
        }}
      />
    </div>
  );
}

export function ModelsPanel({ product }: { product: ProductDetail }) {
  const upload = useUploadAsset(product.id, "models");
  const remove = useDeleteAsset(product.id, "models");
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState({ variant_id: "", scale: "1", is_primary: true });
  const [deleting, setDeleting] = useState<string | null>(null);

  const submit = async () => {
    if (!file) return;
    try {
      await upload.mutateAsync({
        file,
        meta: {
          variant_id: meta.variant_id || null,
          scale: Number(meta.scale) || 1,
          is_primary: meta.is_primary,
        },
      });
      toast({ title: "3D model uploaded", tone: "success" });
      setFile(null);
    } catch (error) {
      toast({ title: "Upload failed", description: errorMessage(error), tone: "error" });
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Add 3D model">
        {file ? (
          <div className="flex flex-col gap-3">
            <p className="flex items-center gap-2 text-sm">
              <Box className="size-4" aria-hidden /> {file.name} ·{" "}
              {(file.size / 1024 / 1024).toFixed(1)} MB
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Variant"
                value={meta.variant_id}
                onChange={(e) => setMeta({ ...meta, variant_id: e.target.value })}
                options={variantOptions(product)}
              />
              <Input
                label="Scale"
                type="number"
                step="0.01"
                min={0.01}
                value={meta.scale}
                onChange={(e) => setMeta({ ...meta, scale: e.target.value })}
                hint="1 = model units are millimetres."
              />
            </div>
            <Checkbox
              label="Primary model for the viewer"
              checked={meta.is_primary}
              onChange={(e) => setMeta({ ...meta, is_primary: e.target.checked })}
            />
            <div className="flex gap-2">
              <Button onClick={submit} loading={upload.isPending}>
                Upload model
              </Button>
              <Button variant="ghost" onClick={() => setFile(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <FilePicker
            id={`model-${product.id}`}
            accept=".glb,model/gltf-binary"
            onPick={setFile}
            label="Choose or drop a .glb file"
            hint="Binary glTF up to 60 MB. Name metal materials *_metal and gems *_gem for material switching."
          />
        )}
      </Card>
      <Card title={`Models (${product.model_3d_assets.length})`}>
        {product.model_3d_assets.length === 0 ? (
          <p className="text-fg-muted text-sm">
            No 3D model yet; the product page shows photos only.
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {product.model_3d_assets.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <Box className="text-accent-text size-4" aria-hidden /> {m.format.toUpperCase()} ·{" "}
                  {(m.file_size_bytes / 1024).toFixed(0)} KB · scale {m.scale}
                  {m.is_primary && <Badge tone="gold">primary</Badge>}
                </span>
                <button
                  type="button"
                  onClick={() => setDeleting(m.id)}
                  className="touch-target text-fg-muted hover:text-danger inline-flex items-center justify-center"
                  aria-label="Delete 3D model"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete this 3D model?"
        danger
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove.mutateAsync(deleting);
            toast({ title: "Model deleted", tone: "success" });
          } catch (error) {
            toast({ title: "Couldn't delete", description: errorMessage(error), tone: "error" });
          }
          setDeleting(null);
        }}
      />
    </div>
  );
}
