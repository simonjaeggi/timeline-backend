import { and, desc, eq, gt, isNull, or } from 'drizzle-orm';
import type { AccessCode, NewAccessCode } from '../models.ts';
import type {
  AccessCodeRepository,
  RedeemAccessCode,
} from '../repositories.ts';
import type { PostgresDb } from './db.ts';
import { withTranslatedErrors } from './error-translation.ts';
import { accessCodes } from './schema.ts';

/** Every column except the hash, which never leaves the data layer. */
const accessCodeColumns = {
  id: accessCodes.id,
  codeHint: accessCodes.codeHint,
  groupId: accessCodes.groupId,
  groupRole: accessCodes.groupRole,
  grantsAppRole: accessCodes.grantsAppRole,
  email: accessCodes.email,
  isInitial: accessCodes.isInitial,
  createdBy: accessCodes.createdBy,
  createdAt: accessCodes.createdAt,
  expiresAt: accessCodes.expiresAt,
  redeemedAt: accessCodes.redeemedAt,
  redeemedByUserId: accessCodes.redeemedByUserId,
  redeemedByEmail: accessCodes.redeemedByEmail,
  revokedAt: accessCodes.revokedAt,
};

export function createAccessCodeRepository(
  db: PostgresDb,
): AccessCodeRepository {
  return {
    async list(): Promise<AccessCode[]> {
      return db
        .select(accessCodeColumns)
        .from(accessCodes)
        .orderBy(desc(accessCodes.createdAt), desc(accessCodes.id));
    },

    async create(input: NewAccessCode): Promise<AccessCode> {
      return withTranslatedErrors(async () => {
        const [code] = await db
          .insert(accessCodes)
          .values(input)
          .returning(accessCodeColumns);
        if (!code) throw new Error('Insert into access_codes returned no row.');
        return code;
      });
    },

    async findByHash(codeHash: string): Promise<AccessCode | null> {
      const [code] = await db
        .select(accessCodeColumns)
        .from(accessCodes)
        .where(eq(accessCodes.codeHash, codeHash));
      return code ?? null;
    },

    async redeem(input: RedeemAccessCode): Promise<AccessCode | null> {
      const [code] = await db
        .update(accessCodes)
        .set({
          redeemedAt: input.now,
          redeemedByEmail: input.email,
          redeemedByUserId: input.userId,
        })
        .where(
          and(
            eq(accessCodes.codeHash, input.codeHash),
            isNull(accessCodes.redeemedAt),
            isNull(accessCodes.revokedAt),
            or(
              isNull(accessCodes.expiresAt),
              gt(accessCodes.expiresAt, input.now),
            ),
            or(isNull(accessCodes.email), eq(accessCodes.email, input.email)),
          ),
        )
        .returning(accessCodeColumns);
      return code ?? null;
    },

    async findPendingSignUp(
      codeHash: string,
      email: string,
    ): Promise<AccessCode | null> {
      const [code] = await db
        .select(accessCodeColumns)
        .from(accessCodes)
        .where(
          and(
            eq(accessCodes.codeHash, codeHash),
            eq(accessCodes.redeemedByEmail, email),
            isNull(accessCodes.redeemedByUserId),
          ),
        );
      return code ?? null;
    },

    async attachUser(id: number, userId: string): Promise<void> {
      await db
        .update(accessCodes)
        .set({ redeemedByUserId: userId })
        .where(eq(accessCodes.id, id));
    },

    async revoke(id: number, now: Date): Promise<AccessCode | null> {
      const [code] = await db
        .update(accessCodes)
        .set({ revokedAt: now })
        .where(
          and(
            eq(accessCodes.id, id),
            isNull(accessCodes.redeemedAt),
            isNull(accessCodes.revokedAt),
          ),
        )
        .returning(accessCodeColumns);
      return code ?? null;
    },

    async hasInitialCode(): Promise<boolean> {
      const [code] = await db
        .select({ id: accessCodes.id })
        .from(accessCodes)
        .where(eq(accessCodes.isInitial, true))
        .limit(1);
      return code !== undefined;
    },
  };
}
