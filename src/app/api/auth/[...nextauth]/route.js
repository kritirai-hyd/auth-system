// app/api/auth/[...nextauth]/route.js
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import validator from "validator";
import { connectMongoDB } from "../../../../../lib/mongodb";
import User from "../../../../../models/user";

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text", placeholder: "user@example.com" },
        password: { label: "Password", type: "password" },
        // Removed 'role' from credentials to prevent spoofing
      },
      async authorize(credentials) {
        const { email, password } = credentials ?? {};

        if (!email || !password) {
          throw new Error("Email and password are required.");
        }

        const normalizedEmail = email.trim().toLowerCase();

        if (!validator.isEmail(normalizedEmail)) {
          throw new Error("Invalid email format.");
        }

        // Connect to MongoDB
        await connectMongoDB();

        // Find user by email, explicitly include password and role fields
        const user = await User.findOne({ email: normalizedEmail }).select("+password +role +name");

        if (!user) {
          throw new Error("Invalid email or password.");
        }

        // Check password validity
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
          throw new Error("Invalid email or password.");
        }

        // Return user data (without password)
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
      // On first sign in, persist user id and role in token
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
      // Redirect /login and sign-in api to dashboard after sign-in
      if (url === "/login" || url === "/api/auth/signin") {
        return `${baseUrl}/dashboard`;
      }
      // Prevent open redirects by ensuring url is relative or same origin
      return url.startsWith(baseUrl) ? url : baseUrl;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login", // Redirect to login page on error
  },

  // Make sure NEXTAUTH_SECRET is set in your environment variables for JWT encryption
  secret: process.env.NEXTAUTH_SECRET,
};

// Export handlers for Next.js route handlers (GET and POST)
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
