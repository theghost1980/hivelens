"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, RotateCcw, Search, User } from "lucide-react";
import { type FormEvent } from "react";
import type { DateRange } from "react-day-picker";

export interface SearchFilters {
  searchTerm: string;
  author: string;
  dateRange?: DateRange;
}

interface SearchControlsProps {
  onSearch: (filters: SearchFilters) => void;
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  syncedDays?: Date[];
  isLoading?: boolean;
}

export function SearchControls({
  onSearch,
  filters,
  onFiltersChange,
  syncedDays,
  isLoading,
}: SearchControlsProps) {
  const handleSearchTermChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ ...filters, searchTerm: e.target.value });
  };

  const handleAuthorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ ...filters, author: e.target.value });
  };

  const handleDateRangeChange = (newDateRange?: DateRange) => {
    onFiltersChange({ ...filters, dateRange: newDateRange });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSearch(filters);
  };

  const handleReset = () => {
    onFiltersChange({ searchTerm: "", author: "", dateRange: undefined });
    onSearch({ searchTerm: "", author: "", dateRange: undefined });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-6 mb-8 bg-card border rounded-lg shadow-sm space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
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
              value={filters.searchTerm}
              onChange={handleSearchTermChange}
              className="pl-10"
            />
          </div>
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
              value={filters.author}
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
                modifiersClassNames={{
                  synced: "day-synced",
                }}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-border">
        <Button
          type="button"
          variant="outline"
          onClick={handleReset}
          disabled={isLoading}
          className="w-full sm:w-auto"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset Filters
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full sm:w-auto bg-primary hover:bg-primary/90"
        >
          <Search className="mr-2 h-4 w-4" />
          {isLoading ? "Searching..." : "Search Images"}
        </Button>
      </div>
    </form>
  );
}
