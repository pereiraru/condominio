import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcrypt';
import { prisma } from './prisma';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const rawEmail = credentials.email.trim();
        const lowerEmail = rawEmail.toLowerCase();

        let user = await prisma.user.findUnique({
          where: { email: rawEmail },
          include: { unit: true, owner: true },
        });
        if (!user && lowerEmail !== rawEmail) {
          user = await prisma.user.findUnique({
            where: { email: lowerEmail },
            include: { unit: true, owner: true },
          });
        }

        if (!user) {
          return null;
        }

        const passwordMatch = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!passwordMatch) {
          return null;
        }

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          unitId: user.unitId,
          unitCode: user.unit?.code,
          ownerId: user.ownerId,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = user.role;
        token.unitId = user.unitId;
        token.unitCode = user.unitCode;
        token.ownerId = user.ownerId;
        token.mustChangePassword = Boolean(user.mustChangePassword);
      } else if (token.id && (trigger === 'update' || token.mustChangePassword)) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id },
          select: {
            email: true,
            name: true,
            role: true,
            unitId: true,
            mustChangePassword: true,
            unit: { select: { code: true } },
          },
        });
        if (fresh) {
          token.email = fresh.email;
          token.name = fresh.name;
          token.role = fresh.role;
          token.unitId = fresh.unitId;
          token.unitCode = fresh.unit?.code;
          token.mustChangePassword = fresh.mustChangePassword;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = (token.email as string) || session.user.email;
        session.user.name = (token.name as string | null | undefined) ?? session.user.name;
        session.user.role = token.role as string;
        session.user.unitId = token.unitId as string | null;
        session.user.unitCode = token.unitCode as string | undefined;
        session.user.ownerId = token.ownerId as string | null | undefined;
        session.user.mustChangePassword = Boolean(token.mustChangePassword);
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
};

// Helper to check if user is admin
export function isAdmin(role: string | undefined): boolean {
  return role === 'admin';
}

// Helper to check if user can access a unit
export function canAccessUnit(
  userRole: string | undefined,
  userUnitId: string | null | undefined,
  targetUnitId: string
): boolean {
  if (isAdmin(userRole)) return true;
  return userUnitId === targetUnitId;
}
