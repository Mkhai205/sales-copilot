'use client';

import * as React from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KNOWLEDGE_CATEGORY_LABELS } from './knowledge-article-dialog';

interface KnowledgeArticleToolbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
}

export function KnowledgeArticleToolbar({
  searchTerm,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
}: KnowledgeArticleToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
      {/* Search Input */}
      <div className="relative w-full sm:w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Tìm kiếm tiêu đề, nội dung..."
          value={searchTerm}
          onChange={e => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
        <Button
          type="button"
          variant={selectedCategory === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onCategoryChange('all')}
          className="text-xs h-8"
        >
          Tất cả
        </Button>
        {Object.entries(KNOWLEDGE_CATEGORY_LABELS).map(([key, label]) => (
          <Button
            key={key}
            type="button"
            variant={selectedCategory === key ? 'default' : 'outline'}
            size="sm"
            onClick={() => onCategoryChange(key)}
            className="text-xs h-8"
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
