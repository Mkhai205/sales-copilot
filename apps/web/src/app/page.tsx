import React from 'react';
import { LeadStatus, ConversationStatus } from '@sales-copilot/shared';
import { Button } from '@/components/ui/button';
import {
  Bot,
  MessageSquare,
  Users,
  Sparkles,
  Activity,
  Layers,
  CheckCircle2,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';

export default function HomePage() {
  const stats = [
    { label: 'Default Lead Status', value: LeadStatus.NEW, icon: Users, color: '#3b82f6' },
    {
      label: 'Default Chat Status',
      value: ConversationStatus.OPEN,
      icon: MessageSquare,
      color: '#10b981',
    },
    { label: 'AI Copilot Engine', value: 'Ready', icon: Bot, color: '#8b5cf6' },
    { label: 'Architecture', value: 'Modular Monolith', icon: Layers, color: '#f59e0b' },
  ];

  const packages = [
    {
      name: '@sales-copilot/contracts',
      description: 'Typed DTOs, Zod Validation Schemas, Domain Events and API contracts',
      status: 'Active',
    },
    {
      name: '@sales-copilot/shared',
      description: 'Domain Enums, Custom Error Hierarchy, Core Utilities and Types',
      status: 'Active',
    },
    {
      name: '@sales-copilot/ai',
      description: 'LLM Gateway interfaces, Tool Execution abstractions and Guardrail policies',
      status: 'Active',
    },
    {
      name: '@sales-copilot/api',
      description: 'NestJS REST API, WebSocket Engine, Background Workers & Swagger Docs',
      status: 'Active',
    },
  ];

  return (
    <main className="min-h-screen p-8 md:p-16 max-w-6xl mx-auto">
      {/* Header */}
      <header className="mb-12 pb-8 border-b border-border flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <Sparkles className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Sales Copilot Platform</h1>
          </div>
          <p className="text-muted-foreground text-base md:text-lg max-w-2xl leading-relaxed">
            Omnichannel conversation & AI sales copilot platform with Next.js 16, NestJS 11,
            PostgreSQL 16, Redis 7, and MinIO S3.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="default">
            <ExternalLink className="w-4 h-4 mr-1.5" />
            API Docs
          </Button>
          <Button variant="default" size="default">
            Explore Dashboard
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </div>
      </header>

      {/* Stats Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        {stats.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className="bg-card text-card-foreground border border-border rounded-xl p-5 flex items-center gap-4 shadow-xs"
            >
              <div
                className="p-3 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${item.color}20` }}
              >
                <Icon className="w-6 h-6" style={{ color: item.color }} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  {item.label}
                </p>
                <p className="text-xl font-bold mt-0.5">{item.value}</p>
              </div>
            </div>
          );
        })}
      </section>

      {/* Packages / Components Overview */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-5 flex items-center gap-2">
          <Activity className="w-5 h-5 text-accent" />
          Monorepo Architecture Components
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {packages.map((pkg, idx) => (
            <div
              key={idx}
              className="bg-card text-card-foreground border border-border rounded-xl p-6 shadow-xs"
            >
              <div className="flex justify-between items-center mb-3">
                <span className="font-mono font-semibold text-primary text-sm">{pkg.name}</span>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" />
                  {pkg.status}
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{pkg.description}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
