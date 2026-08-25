import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type {
  AutomationRuleDto,
  AutomationRuleListQueryDto,
  CreateAutomationRuleDto,
  UpdateAutomationRuleDto,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database';
import { mapAutomationRuleToDto } from './automation-rules.mapper';

@Injectable()
export class AutomationRulesService {
  private readonly logger = new Logger(AutomationRulesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Creates a new Automation Rule within a specific workspace.
   */
  async create(
    workspaceId: string,
    dto: CreateAutomationRuleDto,
    actorUserId?: string,
  ): Promise<AutomationRuleDto> {
    const client = this.prisma.getClient();
    const name = dto.name.trim();

    if (!name) {
      throw new BadRequestException({
        code: 'INVALID_RULE_NAME',
        message: 'Rule name cannot be empty',
      });
    }

    const created = await client.automationRule.create({
      data: {
        workspaceId,
        name,
        description: dto.description ? dto.description.trim() : null,
        eventTrigger: dto.eventTrigger,
        conditions: (dto.conditions as any) ?? [],
        actions: (dto.actions as any) ?? [],
        isActive: dto.isActive ?? true,
      },
    });

    const responseDto = mapAutomationRuleToDto(created);

    this.eventEmitter.emit('automation_rule.created', {
      workspaceId,
      rule: responseDto,
      userId: actorUserId,
    });

    this.logger.log(
      `Created automation rule '${responseDto.name}' (${responseDto.id}) with trigger '${responseDto.eventTrigger}' in workspace '${workspaceId}'`,
    );

    return responseDto;
  }

  /**
   * Lists all automation rules for a workspace with optional filters.
   * Evaluated order defaults to createdAt ASC.
   */
  async list(
    workspaceId: string,
    query?: AutomationRuleListQueryDto,
  ): Promise<AutomationRuleDto[]> {
    const client = this.prisma.getClient();
    const where: Record<string, unknown> = { workspaceId };

    if (query?.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query?.eventTrigger) {
      where.eventTrigger = query.eventTrigger;
    }

    const rawSearch = query?.search || query?.q;
    if (rawSearch && rawSearch.trim() !== '') {
      const searchTerm = rawSearch.trim();
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const rules = await client.automationRule.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    return rules.map(mapAutomationRuleToDto);
  }

  /**
   * Retrieves a single automation rule by ID within a workspace.
   */
  async getById(workspaceId: string, id: string): Promise<AutomationRuleDto> {
    const client = this.prisma.getClient();
    const found = await client.automationRule.findFirst({
      where: { id, workspaceId },
    });

    if (!found) {
      throw new NotFoundException({
        code: 'AUTOMATION_RULE_NOT_FOUND',
        message: `Automation rule with id '${id}' not found in this workspace`,
      });
    }

    return mapAutomationRuleToDto(found);
  }

  /**
   * Updates an existing automation rule in the workspace.
   */
  async update(
    workspaceId: string,
    id: string,
    dto: UpdateAutomationRuleDto,
    actorUserId?: string,
  ): Promise<AutomationRuleDto> {
    const client = this.prisma.getClient();
    const existing = await client.automationRule.findFirst({
      where: { id, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'AUTOMATION_RULE_NOT_FOUND',
        message: `Automation rule with id '${id}' not found in this workspace`,
      });
    }

    const updateData: Record<string, unknown> = {};

    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      if (!trimmedName) {
        throw new BadRequestException({
          code: 'INVALID_RULE_NAME',
          message: 'Rule name cannot be empty',
        });
      }
      updateData.name = trimmedName;
    }

    if (dto.description !== undefined) {
      updateData.description = dto.description ? dto.description.trim() : null;
    }

    if (dto.eventTrigger !== undefined) {
      updateData.eventTrigger = dto.eventTrigger;
    }

    if (dto.conditions !== undefined) {
      updateData.conditions = dto.conditions as any;
    }

    if (dto.actions !== undefined) {
      updateData.actions = dto.actions as any;
    }

    if (dto.isActive !== undefined) {
      updateData.isActive = dto.isActive;
    }

    const updated = await client.automationRule.update({
      where: { id },
      data: updateData,
    });

    const responseDto = mapAutomationRuleToDto(updated);

    this.eventEmitter.emit('automation_rule.updated', {
      workspaceId,
      rule: responseDto,
      userId: actorUserId,
    });

    this.logger.log(
      `Updated automation rule '${responseDto.name}' (${responseDto.id}) in workspace '${workspaceId}'`,
    );

    return responseDto;
  }

  /**
   * Deletes an automation rule from the workspace.
   */
  async delete(workspaceId: string, id: string, actorUserId?: string): Promise<{ success: true }> {
    const client = this.prisma.getClient();
    const existing = await client.automationRule.findFirst({
      where: { id, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'AUTOMATION_RULE_NOT_FOUND',
        message: `Automation rule with id '${id}' not found in this workspace`,
      });
    }

    await client.automationRule.delete({
      where: { id },
    });

    this.eventEmitter.emit('automation_rule.deleted', {
      workspaceId,
      ruleId: id,
      name: existing.name,
      userId: actorUserId,
    });

    this.logger.log(
      `Deleted automation rule '${existing.name}' (${id}) from workspace '${workspaceId}'`,
    );

    return { success: true };
  }
}
