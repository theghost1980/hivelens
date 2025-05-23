"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SearchControlsProps, SearchFilters } from "@/lib/types";
import { format } from "date-fns";
import {
  CalendarIcon,
  DownloadCloud,
  Loader2,
  RotateCcw,
  Search,
  Tag,
  TextCursorInput,
  User,
  X,
} from "lucide-react";
import React, { useEffect, useState, type FormEvent } from "react";
import type { DateRange } from "react-day-picker";

function SearchControlsComponent({
  availableTags,
  onSearch,
  filters,
  onFiltersChange,
  syncedDays,
  isSearching,
  onSync,
  isSyncing,
}: SearchControlsProps) {
  const [isTagsComboboxOpen, setIsTagsComboboxOpen] = useState(false);
  const [tagsComboboxInputValue, setTagsComboboxInputValue] = useState("");

  const [searchTerm, setSearchTerm] = useState(filters.searchTerm || "");
  const [title, setTitle] = useState(filters.title || "");
  const [author, setAuthor] = useState(filters.author || "");

  useEffect(() => {
    setSearchTerm(filters.searchTerm || "");
    setTitle(filters.title || "");
    setAuthor(filters.author || "");
  }, [filters.searchTerm, filters.title, filters.author]);

  const handleSearchTermChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    onFiltersChange({ ...filters, searchTerm: newValue });
  };

  const handleAuthorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setAuthor(newValue);
    onFiltersChange({ ...filters, author: newValue });
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setTitle(newValue);
    onFiltersChange({ ...filters, title: newValue });
  };

  const handleDateRangeChange = (newDateRange?: DateRange) => {
    onFiltersChange({ ...filters, dateRange: newDateRange });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSearch(filters);
  };

  const handleReset = () => {
    const resetFilters: SearchFilters = {
      searchTerm: "",
      title: "",
      tags: "",
      author: "",
      dateRange: undefined,
    };
    onFiltersChange(resetFilters);
    onSearch(resetFilters);
  };

  const selectedTagsArray = (filters.tags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag);

  const handleTagSelectFromCombobox = (tag: string) => {
    const newTagsArray = [...selectedTagsArray];
    if (!newTagsArray.includes(tag)) {
      newTagsArray.push(tag);
      onFiltersChange({ ...filters, tags: newTagsArray.join(", ") });
    }
    setIsTagsComboboxOpen(false);
  };

  const handleTagRemoveBadge = (tagToRemove: string) => {
    const newTagsArray = selectedTagsArray.filter((tag) => tag !== tagToRemove);
    onFiltersChange({ ...filters, tags: newTagsArray.join(", ") });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-6 mb-8 bg-card border rounded-lg shadow-sm space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 items-end">
        <div>
          <Label
            htmlFor="searchTerm"
            className="block text-sm font-medium mb-1"
          >
            Search Term
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              id="searchTerm"
              type="text"
              placeholder="Keywords, title..."
              value={searchTerm}
              onChange={handleSearchTermChange}
              className="pl-10"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="title" className="block text-sm font-medium mb-1">
            Specific Title
          </Label>
          <div className="relative">
            <TextCursorInput className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              id="title"
              type="text"
              placeholder="Exact or partial title"
              value={title}
              onChange={handleTitleChange}
              className="pl-10"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="tags" className="block text-sm font-medium mb-1">
            Tags (comma-sep.)
          </Label>
          <Popover
            open={isTagsComboboxOpen}
            onOpenChange={setIsTagsComboboxOpen}
          >
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={isTagsComboboxOpen}
                className="w-full justify-start text-left font-normal h-10"
              >
                <Tag className="mr-2 h-4 w-4 text-muted-foreground" />
                {selectedTagsArray.length > 0
                  ? `${selectedTagsArray.length} tag(s) seleccionados`
                  : "Seleccionar tags..."}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
              <Command>
                <CommandInput
                  placeholder="Buscar o añadir tag..."
                  className="h-9"
                  value={tagsComboboxInputValue}
                  onValueChange={setTagsComboboxInputValue}
                />
                <CommandEmpty>
                  No se encontraron tags. Puedes añadir uno nuevo.
                </CommandEmpty>
                <CommandGroup className="max-h-60 overflow-y-auto">
                  {availableTags.map((tag) => (
                    <CommandItem
                      key={tag}
                      value={tag}
                      onSelect={(currentValue: string) => {
                        const originalTag = availableTags.find(
                          (t) => t.toLowerCase() === currentValue.toLowerCase()
                        );
                        if (originalTag) {
                          handleTagSelectFromCombobox(originalTag);
                        }
                      }}
                    >
                      {tag}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
          {selectedTagsArray.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {selectedTagsArray.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="flex items-center"
                >
                  {tag}
                  <button
                    type="button"
                    className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    onClick={() => handleTagRemoveBadge(tag)}
                  >
                    <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div>
          <Label htmlFor="author" className="block text-sm font-medium mb-1">
            Author
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              id="author"
              type="text"
              placeholder="Hive username"
              value={author}
              onChange={handleAuthorChange}
              className="pl-10"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="dateRange" className="block text-sm font-medium mb-1">
            Date Range
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="dateRange"
                variant="outline"
                className="w-full justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.dateRange?.from ? (
                  filters.dateRange.to ? (
                    <>
                      {format(filters.dateRange.from, "LLL dd, y")} -{" "}
                      {format(filters.dateRange.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(filters.dateRange.from, "LLL dd, y")
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={
                  filters.dateRange?.from ||
                  (syncedDays && syncedDays.length > 0
                    ? syncedDays[0]
                    : undefined)
                }
                selected={filters.dateRange}
                onSelect={handleDateRangeChange}
                modifiers={{ synced: syncedDays || [] }}
                modifiersClassNames={{ synced: "day-synced" }}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row justify-start gap-3 pt-6 border-t border-border mt-6">
        {/* Botón de Sync with Hive */}
        <Button
          type="button"
          variant="default"
          onClick={onSync}
          disabled={
            isSearching ||
            isSyncing ||
            !filters.dateRange?.from ||
            !filters.dateRange?.to
          }
          className="w-full sm:w-auto"
        >
          {isSyncing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <DownloadCloud className="mr-2 h-4 w-4" />
          )}
          {isSyncing ? "Syncing..." : "Sync with Hive"}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={handleReset}
          disabled={isSearching || isSyncing}
          className="w-full sm:w-auto"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset Filters
        </Button>
        <Button
          type="submit"
          disabled={isSearching || isSyncing}
          className="w-full sm:w-auto bg-primary hover:bg-primary/90"
        >
          <Search className="mr-2 h-4 w-4" />
          {isSearching ? "Searching..." : "Search Images"}
        </Button>
      </div>
    </form>
  );
}

export const SearchControls = React.memo(SearchControlsComponent);
