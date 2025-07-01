// pages/register.js
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import "../assets/css/style.css";
import "../assets/css/user.css";
export default function Register() {
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", password: "", role: "" });
  const [message, setMessage] = useState("");
  const router = useRouter();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await axios.post("/api/register/", formData);
      setMessage("Registration successful!");
      setTimeout(() => router.push("/login"), 1500);
    } catch (err) {
      setMessage(err.response?.data?.error || "Registration failed.");
    }
  };

  return (
    <div className="register-container">
      <h2>Register</h2>
      <form onSubmit={handleSubmit}>
        <label>Name</label>
        <input name="name" required value={formData.name} onChange={handleChange} />

        <label>Email</label>
        <input type="email" name="email" required value={formData.email} onChange={handleChange} />

        <label>Phone</label>
        <input name="phone" required value={formData.phone} onChange={handleChange} />

        <label>Password</label>
        <input type="password" name="password" required value={formData.password} onChange={handleChange} />

        <label>Role</label>
        <select name="role" required value={formData.role} onChange={handleChange}>
          <option value="">-- Select Role --</option>
          <option value="user">User</option>
          <option value="manager">Manager</option>
          <option value="accountant">Accountant</option>
        </select>

        {message && <p>{message}</p>}
        <button type="submit">Register</button>
      </form>
        <div className="login-link">
        Don't have an account? <a href="/login">Login here</a>
      </div>
    </div>
  );
}
