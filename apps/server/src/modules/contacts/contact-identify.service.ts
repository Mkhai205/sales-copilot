import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { ContactDto, IdentifyContactDto } from '@sales-copilot/shared-contracts';
import { Prisma } from '../../infrastructure/database/generated/client';
import { PrismaService } from '../../infrastructure/database';
import { ContactMergeService } from './contact-merge.service';
import { mapContactToDto } from './contacts.mapper';

export interface IdentifyOptions {
  /** When true, the original base contact name is preserved after merge (not overwritten by params.name). */
  retainOriginalContactName?: boolean;
  performedByUserId?: string | null;
  /** Pass an active Prisma.TransactionClient to join an existing transaction. */
  tx?: Prisma.TransactionClient;
}

@Injectable()
export class ContactIdentifyService {
  private readonly logger = new Logger(ContactIdentifyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contactMergeService: ContactMergeService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Identifies and reconciles a contact within a workspace using the priority chain:
   * 1. Identifier -> merge if existing contact with same identifier found.
   * 2. Email -> merge if existing contact with same email found (unless identifier conflict).
   * 3. PhoneNumber -> merge if existing contact with same phone found (unless identifier/email conflict).
   * 4. Updates remaining valid fields and deep merges customAttributes/additionalAttributes.
   */
  async identify(
    workspaceId: string,
    currentContact: { id: string },
    params: IdentifyContactDto,
    options?: IdentifyOptions,
  ): Promise<ContactDto> {
    const runInTx = async (tx: Prisma.TransactionClient): Promise<ContactDto> => {
      // 1. Fetch active contact
       
      let activeContact: any = await tx.contact.findFirst({
        where: { id: currentContact.id, workspaceId },
        include: { identities: true },
      });

      if (!activeContact) {
        throw new NotFoundException({
          code: 'CONTACT_NOT_FOUND',
          message: `Contact with id '${currentContact.id}' not found in workspace`,
        });
      }

      const initialSnapshot = activeContact;

      // Clean/normalize parameters
      const cleanIdentifier =
        params.identifier && params.identifier.trim() !== '' ? params.identifier.trim() : null;
      const cleanEmail =
        params.email && params.email.trim() !== '' ? params.email.trim().toLowerCase() : null;
      const cleanPhone =
        params.phoneNumber && params.phoneNumber.trim() !== '' ? params.phoneNumber.trim() : null;
      const cleanName = params.name && params.name.trim() !== '' ? params.name.trim() : null;
      const cleanAvatarUrl =
        params.avatarUrl && params.avatarUrl.trim() !== '' ? params.avatarUrl.trim() : null;

      const attributesToUpdate = {
        name: true,
        email: true,
        phoneNumber: true,
        identifier: true,
        avatarUrl: true,
      };

      // Step 1: Identifier priority check
      if (cleanIdentifier) {
        const existingIdentifiedContact = await tx.contact.findFirst({
          where: { workspaceId, identifier: cleanIdentifier },
          include: { identities: true },
        });

        if (existingIdentifiedContact && existingIdentifiedContact.id !== activeContact.id) {
          // Merge current activeContact into existing identified contact (base = existingIdentifiedContact)
          activeContact = await this.contactMergeService.merge(
            workspaceId,
            existingIdentifiedContact.id,
            activeContact.id,
            { tx, performedByUserId: options?.performedByUserId },
          );

          if (options?.retainOriginalContactName) {
            attributesToUpdate.name = false;
          }
        }
      }

      // Step 2: Email priority check
      if (cleanEmail) {
        const existingEmailContact = await tx.contact.findFirst({
          where: { workspaceId, email: cleanEmail },
          include: { identities: true },
        });

        if (existingEmailContact && existingEmailContact.id !== activeContact.id) {
          // Conflict guard: reject merge if candidate has a different identifier
          const hasIdentifierConflict =
            existingEmailContact.identifier &&
            cleanIdentifier &&
            existingEmailContact.identifier !== cleanIdentifier;

          if (hasIdentifierConflict) {
            attributesToUpdate.email = false;
            this.logger.warn(
              `Identifier conflict detected when matching email '${cleanEmail}' for contact '${activeContact.id}' against existing '${existingEmailContact.id}'`,
            );
          } else {
            // Merge current activeContact into existing email contact (base = existingEmailContact)
            activeContact = await this.contactMergeService.merge(
              workspaceId,
              existingEmailContact.id,
              activeContact.id,
              { tx, performedByUserId: options?.performedByUserId },
            );

            if (options?.retainOriginalContactName) {
              attributesToUpdate.name = false;
            }
          }
        }
      }

      // Step 3: Phone number priority check
      if (cleanPhone) {
        const existingPhoneContact = await tx.contact.findFirst({
          where: { workspaceId, phoneNumber: cleanPhone },
          include: { identities: true },
        });

        if (existingPhoneContact && existingPhoneContact.id !== activeContact.id) {
          // Conflict guard 1: Identifier conflict
          const hasIdentifierConflict =
            existingPhoneContact.identifier &&
            cleanIdentifier &&
            existingPhoneContact.identifier !== cleanIdentifier;

          // Conflict guard 2: Email conflict
          const hasEmailConflict =
            existingPhoneContact.email &&
            cleanEmail &&
            existingPhoneContact.email.toLowerCase() !== cleanEmail.toLowerCase();

          if (hasIdentifierConflict || hasEmailConflict) {
            attributesToUpdate.phoneNumber = false;
            this.logger.warn(
              `Conflict detected when matching phone '${cleanPhone}' for contact '${activeContact.id}' against existing '${existingPhoneContact.id}' (idConflict=${!!hasIdentifierConflict}, emailConflict=${!!hasEmailConflict})`,
            );
          } else {
            // Merge current activeContact into existing phone contact (base = existingPhoneContact)
            activeContact = await this.contactMergeService.merge(
              workspaceId,
              existingPhoneContact.id,
              activeContact.id,
              { tx, performedByUserId: options?.performedByUserId },
            );

            if (options?.retainOriginalContactName) {
              attributesToUpdate.name = false;
            }
          }
        }
      }

      // Step 4: Deep merge customAttributes & additionalAttributes and update contact
      const existingCustom =
        typeof activeContact.customAttributes === 'object' &&
        activeContact.customAttributes !== null
          ? (activeContact.customAttributes as Record<string, unknown>)
          : {};
      const newCustom = params.customAttributes
        ? { ...existingCustom, ...params.customAttributes }
        : existingCustom;

      const existingAdditional =
        typeof activeContact.additionalAttributes === 'object' &&
        activeContact.additionalAttributes !== null
          ? (activeContact.additionalAttributes as Record<string, unknown>)
          : {};
      const newAdditional = params.additionalAttributes
        ? { ...existingAdditional, ...params.additionalAttributes }
        : existingAdditional;

      const updateData: Record<string, unknown> = {
        customAttributes: newCustom,
        additionalAttributes: newAdditional,
      };

      if (attributesToUpdate.name && cleanName) {
        updateData.name = cleanName;
      }
      if (attributesToUpdate.email && cleanEmail) {
        updateData.email = cleanEmail;
      }
      if (attributesToUpdate.phoneNumber && cleanPhone) {
        updateData.phoneNumber = cleanPhone;
      }
      if (attributesToUpdate.identifier && cleanIdentifier) {
        updateData.identifier = cleanIdentifier;
      }
      if (attributesToUpdate.avatarUrl && cleanAvatarUrl) {
        updateData.avatarUrl = cleanAvatarUrl;
      }

      const updated = await tx.contact.update({
        where: { id: activeContact.id },
        data: updateData,
        include: { identities: true },
      });

      const contactDto = mapContactToDto(updated);

      this.eventEmitter.emit('contact.updated', {
        workspaceId,
        contact: contactDto,
        previousAttributes: {
          customAttributes: initialSnapshot.customAttributes,
          additionalAttributes: initialSnapshot.additionalAttributes,
        },
      });

      this.logger.log(
        `Identified/reconciled contact '${contactDto.id}' in workspace '${workspaceId}'`,
      );

      return contactDto;
    };

    if (options?.tx) {
      return runInTx(options.tx);
    }

    return this.prisma.runInTransaction(ctx => runInTx(ctx.txClient));
  }
}
