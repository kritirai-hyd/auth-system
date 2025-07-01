import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectMongoDB } from "../../../../../lib/mongodb";
import User from "../../../../../models/user";
import validator from "validator";

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text", placeholder: "user@example.com" },
        password: { label: "Password", type: "password" },
        role: { label: "Role", type: "text", placeholder: "manager or user" },
      },
      async authorize(credentials) {
        const { email, password, role } = credentials ?? {};

        if (!email || !password || !role) {
          throw new Error("All fields are required.");
        }

        // Sanitize and validate input
        const normalizedEmail = email.trim().toLowerCase();
        const normalizedRole = role.trim().toLowerCase();

        if (!validator.isEmail(normalizedEmail)) {
          throw new Error("Invalid email format.");
        }

        await connectMongoDB();

        // Find user by email, include password and role explicitly (select +password +role)
        const user = await User.findOne({ email: normalizedEmail }).select("+password +role");

        if (!user) {
          // Avoid revealing whether email or password is wrong
          throw new Error("Invalid credentials.");
        }

        // Validate password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          throw new Error("Invalid credentials.");
        }

        // Role check (case-insensitive)
        if (user.role.toLowerCase() !== normalizedRole) {
          throw new Error("Invalid credentials.");
        }

        // Return safe user object without password
        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      // Redirect to dashboard after signin or login page
      if (url === "/api/auth/signin" || url === "/login") {
        return `${baseUrl}/dashboard`;
      }
      // Prevent open redirects outside your domain
      return url.startsWith(baseUrl) ? url : baseUrl;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login", // Redirects to login page with error param
  },

  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
