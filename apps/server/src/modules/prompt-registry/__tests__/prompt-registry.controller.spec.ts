import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { LlmProvider, WorkspaceRole } from '@sales-copilot/shared-contracts';
import { PromptRegistryController } from '../prompt-registry.controller';
import type { WorkspaceContext } from '../../workspaces/types/workspace-context.type';

describe('PromptRegistryController', () => {
  let controller: PromptRegistryController;
  let mockPromptRegistryService: any;
  let mockLlmGatewayService: any;

  const mockContext: WorkspaceContext = {
    workspaceId: 'ws_ctrl_test',
    role: WorkspaceRole.ADMIN,
    workspace: {
      id: 'ws_ctrl_test',
      name: 'Test Workspace',
      slug: 'test-ws',
      billingPlan: 'STANDARD',
      timezone: 'Asia/Ho_Chi_Minh',
      defaultLanguage: 'vi',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const testUserId = 'usr_admin';

  beforeEach(() => {
    mockPromptRegistryService = {
      listTemplates: async (wsId: string) => [
        { id: 'tpl_1', workspaceId: wsId, name: 'TEST_TPL', version: 1 },
      ],
      createTemplate: async (wsId: string, dto: any, userId?: string) => ({
        id: 'tpl_new',
        workspaceId: wsId,
        createdById: userId,
        ...dto,
      }),
      findTemplate: async (wsId: string, name: string) => ({
        id: 'tpl_1',
        workspaceId: wsId,
        name,
        version: 1,
      }),
      updateTemplate: async (wsId: string, id: string, dto: any) => ({
        id,
        workspaceId: wsId,
        ...dto,
      }),
      renderPrompt: async (wsId: string, name: string, vars: any) => ({
        systemPrompt: 'System prompt compiled',
        userPrompt: `User prompt compiled for ${vars.name}`,
        template: {
          name,
          model: 'gemini-2.5-flash',
          provider: LlmProvider.GEMINI,
          temperature: 0.2,
          maxTokens: 1024,
        },
      }),
    };

    mockLlmGatewayService = {
      generateCompletion: async (_req: any) => ({
        content: 'Sandbox response from LLM',
        metrics: {
          promptTokens: 10,
          completionTokens: 10,
          totalTokens: 20,
          latencyMs: 100,
          estimatedCostUsd: 0,
          provider: LlmProvider.GEMINI,
          model: 'gemini-2.5-flash',
        },
        provider: LlmProvider.GEMINI,
        model: 'gemini-2.5-flash',
      }),
    };

    controller = new PromptRegistryController(mockPromptRegistryService, mockLlmGatewayService);
  });

  it('should list templates for workspace', async () => {
    const list = await controller.listTemplates(mockContext, {});
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].name, 'TEST_TPL');
  });

  it('should create template passing workspaceId and userId', async () => {
    const created = await controller.createTemplate(
      mockContext,
      {
        name: 'NEW_TPL',
        version: 1,
        provider: LlmProvider.GEMINI,
        model: 'gemini-2.5-flash',
        systemPrompt: 'Sys',
        userPromptTemplate: 'User',
        inputVariables: [],
        temperature: 0.2,
        maxTokens: 1024,
        isDefault: true,
        isActive: true,
      },
      testUserId,
    );

    assert.strictEqual(created.workspaceId, mockContext.workspaceId);
    assert.strictEqual(created.createdById, testUserId);
  });

  it('should get template by name', async () => {
    const tpl = await controller.getTemplate(mockContext, 'TEST_TPL');
    assert.strictEqual(tpl.name, 'TEST_TPL');
  });

  it('should update template by id', async () => {
    const updated = await controller.updateTemplate(mockContext, 'tpl_1', {
      temperature: 0.5,
    });
    assert.strictEqual(updated.id, 'tpl_1');
    assert.strictEqual(updated.temperature, 0.5);
  });

  it('should render prompt with variables', async () => {
    const rendered = await controller.renderPrompt(mockContext, 'TEST_TPL', {
      variables: { name: 'John Doe' },
    });
    assert.strictEqual(rendered.systemPrompt, 'System prompt compiled');
    assert.ok(rendered.userPrompt.includes('John Doe'));
  });

  it('should execute sandbox test through LlmGatewayService', async () => {
    const result = await controller.testPrompt(mockContext, 'TEST_TPL', {
      variables: { name: 'John Doe' },
      provider: LlmProvider.GEMINI,
    });

    assert.ok(result.rendered);
    assert.strictEqual(result.completion.content, 'Sandbox response from LLM');
    assert.strictEqual(result.completion.provider, LlmProvider.GEMINI);
  });
});
