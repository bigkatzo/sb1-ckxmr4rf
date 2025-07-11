import React, { useState, useEffect, useCallback } from "react";
import { X, Plus, Trash2, Palette, Info } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { Toggle } from "../../ui/Toggle";
import {
  formatDate,
  getUserTimezone,
  isFutureDate,
  formatCountdown,
} from "../../../utils/date-helpers";
import type { Collection } from "../../../types/collections";
import { Dialog } from "@headlessui/react";
import { OptimizedImage } from "../../ui/OptimizedImage";
import { CollectionThemeSettings } from "./CollectionThemeSettings";
import { toast } from "react-toastify";
import { useSiteSettings } from "../../../hooks/useSiteSettings";
import { cacheManager } from "../../../lib/cache";
import { useCollectionContext } from "../../../contexts/CollectionContext";
import { createPortal } from "react-dom";

export interface CollectionFormProps {
  collection?: Partial<Collection & { tags?: string[]; launch_date?: string }>;
  onSubmit: (data: FormData) => Promise<void>;
  onClose: () => void;
}

/**
 * Converts a Date object to the `datetime-local` string format –
 * e.g. "2025-07-11T23:00" (no seconds, no timezone).
 */
const toInputDateTime = (date: Date): string => {
  return date.toISOString().slice(0, 16);
};

/**
 * Safely parses the `datetime-local` input value to a Date. Returns `null`
 * if the value cannot be parsed.
 */
const safeParseDate = (value: string): Date | null => {
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
};

export function CollectionForm({ collection, onSubmit, onClose }: CollectionFormProps) {
  // --------------------------------------------------
  // Local state helpers & initialisation -------------
  // --------------------------------------------------
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Image handling -----------------------------------
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(collection?.imageUrl || "");
  const [removeImage, setRemoveImage] = useState(false);

  // Basic form fields --------------------------------
  const [name, setName] = useState(collection?.name || "");
  const [slug, setSlug] = useState(collection?.slug || "");
  const [autoSlug, setAutoSlug] = useState(!collection?.slug);
  const [visible, setVisible] = useState(collection?.visible ?? true);
  const [saleEnded, setSaleEnded] = useState(collection?.saleEnded ?? false);
  const [description, setDescription] = useState(collection?.description || "");
  const [freeNotes, setFreeNotes] = useState(collection?.free_notes || "");

  // Links --------------------------------------------
  const [customUrl, setCustomUrl] = useState(collection?.custom_url || "");
  const [xUrl, setXUrl] = useState(collection?.x_url || "");
  const [telegramUrl, setTelegramUrl] = useState(collection?.telegram_url || "");
  const [dexscreenerUrl, setDexscreenerUrl] = useState(collection?.dexscreener_url || "");
  const [pumpfunUrl, setPumpfunUrl] = useState(collection?.pumpfun_url || "");
  const [websiteUrl, setWebsiteUrl] = useState(collection?.website_url || "");

  // Tags ---------------------------------------------
  const [tags, setTags] = useState<string[]>(collection?.tags || []);
  const [tagInput, setTagInput] = useState("");

  // Launch date --------------------------------------
  const [launchDate, setLaunchDate] = useState(() => {
    if (collection?.launchDate instanceof Date && !isNaN(collection.launchDate.getTime())) {
      return toInputDateTime(collection.launchDate);
    }
    if (collection?.launch_date) {
      const parsed = new Date(collection.launch_date);
      if (!isNaN(parsed.getTime())) return toInputDateTime(parsed);
    }
    return toInputDateTime(new Date());
  });

  // Theme settings -----------------------------------
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [showImageTooltip, setShowImageTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const { invalidateCollection } = useCollectionContext();
  const { data: siteSettings } = useSiteSettings();

  const [themeData, setThemeData] = useState(() => ({
    theme_primary_color: collection?.theme_primary_color || null,
    theme_secondary_color: collection?.theme_secondary_color || null,
    theme_background_color: collection?.theme_background_color || null,
    theme_text_color: collection?.theme_text_color || null,
    theme_use_custom: collection?.theme_use_custom || false,
    theme_use_classic: collection?.theme_use_classic !== false,
    theme_logo_url: collection?.theme_logo_url || null,
  }));

  // Sync theme data when external data changes --------
  useEffect(() => {
    setThemeData({
      theme_primary_color: collection?.theme_primary_color || null,
      theme_secondary_color: collection?.theme_secondary_color || null,
      theme_background_color: collection?.theme_background_color || null,
      theme_text_color: collection?.theme_text_color || null,
      theme_use_custom: collection?.theme_use_custom || false,
      theme_use_classic: collection?.theme_use_classic !== false,
      theme_logo_url: collection?.theme_logo_url || null,
    });
  }, [collection, siteSettings]);

  // --------------------------------------------------
  // Drop‑zone setup ----------------------------------
  // --------------------------------------------------
  const { getRootProps, getInputProps } = useDropzone({
    accept: { "image/*": [] },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0];
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
      setRemoveImage(false);
    },
  });

  // --------------------------------------------------
  // Event handlers -----------------------------------
  // --------------------------------------------------
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    if (autoSlug) {
      setSlug(newName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    }
  };

  const handleRemoveImage = () => {
    setImage(null);
    setImagePreview("");
    setRemoveImage(true);
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const newTag = tagInput.trim().toLowerCase();
      if (newTag && !tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setTagInput("");
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleThemeChange = (field: string, value: any) => {
    setThemeData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleImageTooltipMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      top: rect.bottom + 8,
      left: rect.left + rect.width / 2,
    });
    setShowImageTooltip(true);
  };

  const handleImageTooltipMouseLeave = () => {
    setShowImageTooltip(false);
  };

  // --------------------------------------------------
  // Helpers ------------------------------------------
  // --------------------------------------------------
  /**
   * Appends all required/common fields to the given `FormData`. Used by both
   * `saveTheme` and the main `handleSubmit`.
   */
  const appendCommonFields = (formData: FormData) => {
    formData.append("name", name);
    formData.append("description", description);
    formData.append("slug", slug);
    formData.append("visible", visible.toString());
    formData.append("sale_ended", saleEnded.toString());
    formData.append("tags", JSON.stringify(tags));

    // Links & notes
    formData.append("free_notes", freeNotes || "");
    formData.append("custom_url", customUrl || "");
    formData.append("x_url", xUrl || "");
    formData.append("telegram_url", telegramUrl || "");
    formData.append("dexscreener_url", dexscreenerUrl || "");
    formData.append("pumpfun_url", pumpfunUrl || "");
    formData.append("website_url", websiteUrl || "");
  };

  // --------------------------------------------------
  // Theme‑only save ----------------------------------
  // --------------------------------------------------
  const saveTheme = async () => {
    try {
      const formData = new FormData();

      // Basic validations – name, slug, launchDate are mandatory even in theme‑only save
      if (!name) throw new Error("Collection name is required");
      if (!slug) throw new Error("Collection ID is required");
      if (!launchDate) throw new Error("Launch date is required");

      appendCommonFields(formData);
      formData.append("launchDate", launchDate); // leave as local string; API should handle as before

      // Theme fields --------------------------------
      formData.append("theme_primary_color", themeData.theme_primary_color || "");
      formData.append("theme_secondary_color", themeData.theme_secondary_color || "");
      formData.append("theme_background_color", themeData.theme_background_color || "");
      formData.append("theme_text_color", themeData.theme_text_color || "");
      formData.append("theme_logo_url", themeData.theme_logo_url || "");

      const hasCustomTheme = Boolean(
        themeData.theme_primary_color ||
          themeData.theme_secondary_color ||
          themeData.theme_background_color ||
          themeData.theme_text_color ||
          themeData.theme_logo_url,
      );
      formData.append("theme_use_custom", hasCustomTheme.toString());
      formData.append("theme_use_classic", themeData.theme_use_classic.toString());

      // For existing collections include ID
      if (collection?.id) formData.append("id", collection.id);

      await onSubmit(formData);

      // Smart cache‑busting – only theme related data
      if (collection?.slug) {
        invalidateCollection(collection.slug);
        cacheManager.invalidateKey(`collection:${collection.slug}`);
        cacheManager.invalidateKey(`collection:${collection.id}`);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      toast.success("Theme settings saved successfully");
      onClose();
    } catch (err: any) {
      console.error("Error saving theme:", err);
      toast.error(err?.message ?? "Failed to save theme settings");
    }
  };

  // --------------------------------------------------
  // Full form submit --------------------------------
  // --------------------------------------------------
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      appendCommonFields(formData);

      // Launch date – convert to ISO (UTC)
      const parsedDate = safeParseDate(launchDate);
      if (!parsedDate) {
        throw new Error("Invalid launch date format. Please check the date and try again.");
      }
      formData.append("launchDate", parsedDate.toISOString());

      // Theme data – preserve existing values when present
      if (themeData.theme_use_custom) {
        formData.append("theme_use_custom", "true");
        formData.append("theme_use_classic", themeData.theme_use_classic.toString());
        if (themeData.theme_primary_color) formData.append("theme_primary_color", themeData.theme_primary_color);
        if (themeData.theme_secondary_color) formData.append("theme_secondary_color", themeData.theme_secondary_color);
        if (themeData.theme_background_color) formData.append("theme_background_color", themeData.theme_background_color);
        if (themeData.theme_text_color) formData.append("theme_text_color", themeData.theme_text_color);
        if (themeData.theme_logo_url) formData.append("theme_logo_url", themeData.theme_logo_url);
      }

      // Image handling --------------------------------
      if (image) formData.append("image", image);
      if (collection?.imageUrl && !removeImage) formData.append("currentImageUrl", collection.imageUrl);
      formData.append("removeImage", removeImage.toString());

      // Existing collection ID
      if (collection?.id) formData.append("id", collection.id);

      await onSubmit(formData);
      onClose();
    } catch (err: any) {
      console.error("Error submitting collection form:", err);
      setError(err?.message ?? "Failed to create collection. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Prevent body scroll when modal open --------------
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  // --------------------------------------------------
  // Render helpers -----------------------------------
  // --------------------------------------------------
  const parsedLaunchDate = safeParseDate(launchDate);

  const renderLaunchDateDebug = () => {
    if (!parsedLaunchDate) return null;
    return (
      <div className="mt-1 text-xs">
        <p className="text-gray-400">Launch scheduled for: {formatDate(parsedLaunchDate, "long")}</p>
        {isFutureDate(parsedLaunchDate) && (
          <p className="text-blue-400 mt-0.5">Countdown: {formatCountdown(parsedLaunchDate)}</p>
        )}
        <p className="text-xs text-gray-500 mt-1">
          Debug: Input="{launchDate}" | Parsed={parsedLaunchDate.toISOString()} | UTC Offset={new Date().getTimezoneOffset()}min
        </p>
      </div>
    );
  };

  // --------------------------------------------------
  // Component JSX ------------------------------------
  // --------------------------------------------------
  return (
    <Dialog open={true} onClose={onClose} className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Container */}
      <div className="fixed inset-0 overflow-y-auto">
        <div className="min-h-full flex items-center justify-center p-0 sm:p-4">
          <div className="relative w-full h-full sm:h-auto sm:max-h-[90vh] bg-gray-900 sm:rounded-xl shadow-xl sm:max-w-2xl flex flex-col">
            {/* Header */}
            <div className="flex-none bg-gray-900 flex justify-between items-center p-4 sm:p-6 border-b border-gray-800">
              <Dialog.Title className="text-lg sm:text-xl font-semibold text-white">
                {collection ? "Edit Collection" : "New Collection"}
              </Dialog.Title>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <form id="collection-form" onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="p-4 bg-red-900/50 border border-red-500 rounded-lg">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                {/* Image uploader -------------------- */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <label htmlFor="image" className="block text-sm font-medium text-white">
                      Collection Image
                    </label>
                    <button
                      type="button"
                      className="text-gray-400 hover:text-white transition-colors"
                      onMouseEnter={handleImageTooltipMouseEnter}
                      onMouseLeave={handleImageTooltipMouseLeave}
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  </div>
                  <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                      imagePreview ? "border-transparent" : "border-gray-700 hover:border-primary cursor-pointer"
                    }`}
                  >
                    <input {...getInputProps()} />
                    {imagePreview ? (
                      <div className="relative group max-w-lg mx-auto">
                        <div className="aspect-[16/9] relative max-h-[400px]">
                          <OptimizedImage
                            src={imagePreview}
                            alt={name || "Collection preview"}
                            width={800}
                            height={450}
                            quality={80}
                            className="absolute inset-0 w-full h-full object-contain rounded-lg"
                            sizes="(max-width: 640px) 100vw, 800px"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveImage();
                                }}
                                className="p-2 bg-red-500/90 rounded-full text-white hover:bg-red-600 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                              <button type="button" className="p-2 bg-primary/90 rounded-full text-white hover:bg-primary transition-colors">
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="mx-auto w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center">
                          <Plus className="h-6 w-6 text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-400">Drag and drop an image, or click to select</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Name -------------------------------- */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-white mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={name}
                    onChange={handleNameChange}
                    required
                    className="w-full rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400"
                    placeholder="Enter collection name"
                  />
                </div>

                {/* Slug / ID --------------------------- */}
                <div>
                  <label htmlFor="slug" className="block text-sm font-medium text-white mb-1">
                    Collection ID
                  </label>
                  <input
                    type="text"
                    id="slug"
                    name="slug"
                    value={slug}
                    onChange={(e) => {
                      setAutoSlug(false);
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                    }}
                    required
                    pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
                    title="Only lowercase letters, numbers, and hyphens are allowed"
                    className="w-full rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400"
                  />
                  <p className="mt-1 text-xs text-gray-400">This ID will be used in the collection's URL</p>
                </div>

                {/* Description ------------------------- */}
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-white mb-1">
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400"
                    placeholder="Enter collection description"
                  />
                </div>

                {/* Free notes -------------------------- */}
                <div>
                  <label htmlFor="free_notes" className="block text-sm font-medium text-white mb-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    id="free_notes"
                    name="free_notes"
                    value={freeNotes}
                    onChange={(e) => setFreeNotes(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400"
                    placeholder="Add additional information for your customers, e.g., '10% of profits go to charity'"
                  />
                </div>

                {/* URL fields -------------------------- */}
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-white">Collection Links (Optional)</label>

                  {/* Website */}
                  <div>
                    <label htmlFor="website_url" className="block text-xs text-gray-400 mb-1">
                      Website URL
                    </label>
                    <input
                      type="url"
                      id="website_url"
                      name="website_url"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      className="w-full rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400"
                      placeholder="https://example.com"
                    />
                  </div>

                  {/* X / Twitter */}
                  <div>
                    <label htmlFor="x_url" className="block text-xs text-gray-400 mb-1">
                      X / Twitter URL
                    </label>
                    <input
                      type="url"
                      id="x_url"
                      name="x_url"
                      value={xUrl}
                      onChange={(e) => setXUrl(e.target.value)}
                      className="w-full rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400"
                      placeholder="https://x.com/username"
                    />
                  </div>

                  {/* Telegram */}
                  <div>
                    <label htmlFor="telegram_url" className="block text-xs text-gray-400 mb-1">
                      Telegram URL
                    </label>
                    <input
                      type="url"
                      id="telegram_url"
                      name="telegram_url"
                      value={telegramUrl}
                      onChange={(e) => setTelegramUrl(e.target.value)}
                      className="w-full rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400"
                      placeholder="https://t.me/example"
                    />
                  </div>

                  {/* DexScreener */}
                  <div>
                    <label htmlFor="dexscreener_url" className="block text-xs text-gray-400 mb-1">
                      DexScreener URL
                    </label>
                    <input
                      type="url"
                      id="dexscreener_url"
                      name="dexscreener_url"
                      value={dexscreenerUrl}
                      onChange={(e) => setDexscreenerUrl(e.target.value)}
                      className="w-full rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400"
                      placeholder="https://dexscreener.com/example"
                    />
                  </div>

                  {/* PumpFun */}
                  <div>
                    <label htmlFor="pumpfun_url" className="block text-xs text-gray-400 mb-1">
                      PumpFun URL
                    </label>
                    <input
                      type="url"
                      id="pumpfun_url"
                      name="pumpfun_url"
                      value={pumpfunUrl}
                      onChange={(e) => setPumpfunUrl(e.target.value)}
                      className="w-full rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400"
                      placeholder="https://pump.fun/example"
                    />
                  </div>

                  {/* Custom */}
                  <div>
                    <label htmlFor="custom_url" className="block text-xs text-gray-400 mb-1">
                      Custom URL
                    </label>
                    <input
                      type="url"
                      id="custom_url"
                      name="custom_url"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      className="w-full rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400"
                      placeholder="https://example.com"
                    />
                  </div>
                </div>

                {/* Launch date ------------------------- */}
                <div>
                  <label htmlFor="launchDate" className="block text-sm font-medium text-white mb-1">
                    Launch Date *
                  </label>
                  <input
                    type="datetime-local"
                    id="launchDate"
                    name="launchDate"
                    value={launchDate}
                    onChange={(e) => setLaunchDate(e.target.value)}
                    required
                    className="w-full rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white"
                  />
                  <p className="mt-1 text-xs text-gray-400">Times are shown in your local timezone ({getUserTimezone()})</p>
                  {renderLaunchDateDebug()}
                </div>

                {/* Tags -------------------------------- */}
                <div>
                  <label className="block text-sm font-medium text-white mb-1">Tags</label>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2 min-h-[2.5rem] bg-gray-800 rounded-lg p-2">
                      {tags.map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-1 bg-primary/20 text-primary px-2 py-1 rounded-full text-sm">
                          {tag}
                          <button type="button" onClick={() => removeTag(tag)} className="hover:text-primary/80">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleTagKeyDown}
                        placeholder={tags.length === 0 ? "Add tags..." : ""}
                        className="flex-1 min-w-[120px] bg-transparent focus:outline-none text-sm text-white placeholder-gray-400"
                      />
                    </div>
                    <p className="text-xs text-gray-400">Press Enter or comma to add a tag. Tags help organize and filter collections.</p>
                  </div>
                </div>

                {/* Visibility -------------------------- */}
                <div>
                  <label className="block text-sm font-medium text-white mb-1">Collection Visibility</label>
                  <div className="flex flex-col gap-1">
                    <Toggle checked={visible} onCheckedChange={setVisible} label="Show in storefront" />
                    <p className="text-xs text-gray-400 ml-11">When disabled, this collection will be hidden from the homepage and search results</p>
                  </div>
                </div>

                {/* End Sale ---------------------------- */}
                <div>
                  <label className="block text-sm font-medium text-white mb-1">End Sale</label>
                  <div className="flex flex-col gap-1">
                    <Toggle checked={saleEnded} onCheckedChange={setSaleEnded} label="End Sale" />
                    <p className="text-xs text-gray-400 ml-11">When enabled, all sales will be disabled and products will show as 'Sale Ended'</p>
                  </div>
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="flex-none bg-gray-900 border-t border-gray-800 p-4 sm:p-6">
              <div className="flex justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setIsThemeModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 text-gray-300 hover:text-white transition-colors bg-gray-800 rounded-lg hover:bg-gray-700"
                >
                  <Palette className="h-4 w-4" />
                  <span className="sm:hidden">Theme</span>
                  <span className="hidden sm:inline">Customize Theme</span>
                </button>
                <div className="flex gap-3">
                  <button type="button" onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white transition-colors">
                    Cancel
                  </button>
                  <button
                    form="collection-form"
                    type="submit"
                    disabled={loading || !name || !launchDate}
                    className="bg-primary hover:bg-primary/80 px-6 py-2 rounded-lg transition-colors disabled:opacity-50 text-white"
                  >
                    {loading ? "Saving..." : collection ? "Save Changes" : "Create Collection"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Theme Settings Modal */}
      <Dialog open={isThemeModalOpen} onClose={() => setIsThemeModalOpen(false)} className="fixed inset-0 z-[60]">
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsThemeModalOpen(false)} />
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-gray-900 p-6 shadow-xl transition-all">
              <div className="flex justify-between items-center mb-4">
                <Dialog.Title className="text-lg font-medium text-white">Collection Theme Settings</Dialog.Title>
                <button onClick={() => setIsThemeModalOpen(false)} className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <CollectionThemeSettings formData={themeData} onChange={handleThemeChange} />

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    // Reset theme data to initial collection values
                    setThemeData({
                      theme_primary_color: collection?.theme_primary_color || null,
                      theme_secondary_color: collection?.theme_secondary_color || null,
                      theme_background_color: collection?.theme_background_color || null,
                      theme_text_color: collection?.theme_text_color || null,
                      theme_use_custom: collection?.theme_use_custom || false,
                      theme_use_classic: collection?.theme_use_classic !== false,
                      theme_logo_url: collection?.theme_logo_url || null,
                    });
                    setIsThemeModalOpen(false);
                  }}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await saveTheme();
                    setIsThemeModalOpen(false);
                  }}
                  className="bg-primary hover:bg-primary/80 px-6 py-2 rounded-lg transition-colors text-white"
                >
                  Save Changes
                </button>
              </div>
            </Dialog.Panel>
          </div>
        </div>
      </Dialog>

      {/* Tooltip portal ------------------------------ */}
      {showImageTooltip &&
        createPortal(
          <div
            className="fixed z-[9999] px-3 py-2 text-xs text-white bg-gray-800 rounded-lg shadow-lg border border-gray-700 max-w-xs"
            style={{ top: tooltipPosition.top, left: tooltipPosition.left, transform: "translateX(-50%)" }}
          >
            <div className="font-medium mb-1">Best Practices</div>
            <div className="space-y-1 text-gray-300">
              <div>• <strong>Format:</strong> 1500x500 pixels (banner style)</div>
              <div>• <strong>Aspect ratio:</strong> 3:1 (wide banner)</div>
              <div>• <strong>File size:</strong> Maximum 5MB</div>
              <div>• <strong>File types:</strong> JPG, PNG, WebP</div>
            </div>
          </div>,
          document.body,
        )}
    </Dialog>
  );
}
