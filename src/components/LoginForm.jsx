"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import "../assets/css/style.css";
import "../assets/css/user.css";

export default function LoginForm() {
  const [formData, setFormData] = useState({ email: "", password: "", role: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { email, password, role } = formData;

    if (!email || !password || !role) {
      setError("All fields are required");
      return;
    }

    setLoading(true);

    const res = await signIn("credentials", {
      redirect: false,
      email,
      password,
      role: role.toLowerCase(),
    });

    setLoading(false);

    if (res?.ok) {
      setSuccess("Login successful! Redirecting...");
      const redirectMap = {
        user: "/user/dashboard",
        manager: "/manager/dashboard",
        accountant: "/accountant/dashboard",
      };
      setTimeout(() => {
        router.push(redirectMap[role.toLowerCase()] || "/");
      }, 1000);
    } else {
      setError(res?.error || "Login failed. Check credentials.");
      setFormData(prev => ({ ...prev, password: "" }));
    }
  };

  return (
    <div className="login-container">
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" name="email" value={formData.email} onChange={handleChange} required />

        <label htmlFor="password">Password</label>
        <input id="password" type="password" name="password" value={formData.password} onChange={handleChange} required />

        <label htmlFor="role">Role</label>
        <select id="role" name="role" value={formData.role} onChange={handleChange} required>
          <option value="">-- Select Role --</option>
          <option value="user">User</option>
          <option value="manager">Manager</option>
          <option value="accountant">Accountant</option>
        </select>

        {error && <p style={{ color: "red" }}>{error}</p>}
        {success && <p style={{ color: "green" }}>{success}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>

      <div className="register-link">
        Don't have an account? <Link href="/register">Register here</Link>
      </div>
    </div>
  );
}
