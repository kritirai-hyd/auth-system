"use client";
import React, { useState, useEffect, useRef } from "react";
import "../assets/css/style.css";
import "../assets/css/user.css";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

function UserInfo() {
     function toggleMenu() {
      const menu = document.getElementById('nav-menu');
      menu.classList.toggle('active');
    }
  const { data: session, status } = useSession();
  const sessionUsername = session?.user?.name || "";

  const [items, setItems] = useState([]);
  const [formState, setFormState] = useState({
    username: sessionUsername,
    name: "",
    description: "",
    price: "",
    quantity: "",
  });
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const firstInputRef = useRef(null);

  useEffect(() => {
    if (status === "authenticated") {
      setFormState((prev) => ({ ...prev, username: sessionUsername }));
      fetchProducts();
    }
  }, [status, sessionUsername]);

  useEffect(() => {
    if (editId && firstInputRef.current) firstInputRef.current.focus();
  }, [editId]);

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/orders");
      const contentType = res.headers.get("content-type") || "";
      const text = await res.text();
      console.log("Raw response text:", text || "<empty>");
      let data = {};

      if (contentType.includes("application/json") && text) {
        data = JSON.parse(text);
      }

      if (!res.ok) throw new Error(data.message || "Failed to fetch");

      setItems(Array.isArray(data.orders) ? data.orders : []);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormState({
      username: sessionUsername,
      name: "",
      description: "",
      price: "",
      quantity: "",
    });
    setEditId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { username, name, description, price, quantity } = formState;
    if (!username || !name || !description || !price || !quantity) {
      alert("Please fill all fields.");
      return;
    }

    const priceFloat = parseFloat(price);
    const quantityInt = parseInt(quantity, 10);
    if (isNaN(priceFloat) || priceFloat < 0) {
      alert("Invalid price."); return;
    }
    if (isNaN(quantityInt) || quantityInt < 1) {
      alert("Invalid quantity."); return;
    }

    const payload = {
      username: username.trim(),
      name: name.trim(),
      description: description.trim(),
      price: priceFloat,
      quantity: quantityInt,
    };

    const endpoint = editId ? `/api/orders?id=${editId}` : "/api/orders";
    const method = editId ? "PUT" : "POST";

    setLoading(true);
    setError(null);

    if (!editId) {
      const tempId = "temp-" + Date.now();
      setItems((prev) => [
        ...prev,
        { ...payload, _id: tempId, status: "pending", approved_by: null, approved_at: null },
      ]);
    }

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let data = {};
      const contentType = res.headers.get("content-type") || "";
      const text = await res.text();
      if (contentType.includes("application/json") && text) {
        data = JSON.parse(text);
      }

      if (!res.ok) throw new Error(data.message || "Request failed");

      await fetchProducts();
      resetForm();
    } catch (err) {
      console.error(err);
      setError(err.message);
      alert("Error: " + err.message);
      if (!editId) {
        setItems((prev) => prev.filter((item) => !item._id.startsWith("temp-")));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item) => {
    setFormState({
      username: item.username || sessionUsername,
      name: item.name,
      description: item.description,
      price: item.price.toString(),
      quantity: item.quantity.toString(),
    });
    setEditId(item._id);
  };

  const handleDelete = async (id) => {
    if (!confirm("Confirm delete?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/orders?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setItems((prev) => prev.filter((i) => i._id !== id));
      if (editId === id) resetForm();
    } catch (err) {
      console.error(err);
      setError(err.message);
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter((item) => item.username === sessionUsername);

  if (status === "loading") return <p>Loading session...</p>;
  if (!session)
    return (
      <main className="user-container">
        <p>Please log in.</p>
        <Link href="/api/auth/signin"><div className="btn">Sign In</div></Link>
      </main>
    );

  return (
    <>
<nav className="navbar">
  <div className="logo">User Dashboard</div>
  <div className="nav">
  <div className="toggle" onClick={() => setIsOpen(!isOpen)}>☰</div>
  <div className={`menu ${isOpen ? "active" : ""}`}>
    <Link href="/login"><span>Manager</span></Link>
    <Link href="/login"><span>Accountant</span></Link>
   
  </div>
   <div className={`menu ${isOpen ? "active" : ""}`}>
              <p>👤 Name: <strong>{session.user.name}</strong></p>
            </div>
               <button onClick={() => signOut()} className={`menu ${isOpen ? "active btn-delete" : "btn-delete"}`} disabled={loading}>
            Log Out
          </button>
          </div>
</nav>

      <main>
        <div className="user-container">
          <form onSubmit={handleSubmit} className="user-info-form">
            <h2>{editId ? "Edit Product" : "Add Product"}</h2>
            {["username", "name", "description", "price", "quantity"].map((field) => (
              <input
                key={field}
                ref={field === "name" ? firstInputRef : null}
                name={field}
                type={["price", "quantity"].includes(field) ? "number" : "text"}
                value={formState[field]}
                onChange={handleInputChange}
                placeholder={field[0].toUpperCase() + field.slice(1)}
                disabled={loading || field === "username"}
                required
                min={field === "price" ? "0" : field === "quantity" ? "1" : undefined}
                step={field === "price" ? "0.01" : field === "quantity" ? "1" : undefined}
                className="user-info-input"
              />
            ))}
            <div className="actions">
              <button type="submit" className="btn-submit" disabled={loading}>
                {editId ? "Update" : "Add"}
              </button>
              {editId && (
                <button type="button" onClick={resetForm} className="btn-cancel" disabled={loading}>
                  Cancel
                </button>
              )}
            </div>
            {loading && <p>Loading...</p>}
            {error && <p className="error" role="alert">{error}</p>}
          </form>
        </div>

        <section className="products-container">
          {!filteredItems.length && !loading && <p>No products found.</p>}
          {filteredItems.map((item) => (
            <div key={item._id} className="card">
              <h3>{item.name}</h3>
              <p>{item.description}</p>
              <p>Price: <strong>₹{item.price.toFixed(2)}</strong></p>
              <p>Quantity: <strong>{item.quantity}</strong></p>
              <p>
                Status:{" "}
                <strong style={{
                  color:
                    item.status === "approved"
                      ? "green"
                      : item.status === "rejected"
                      ? "red"
                      : "#ff7700",
                }}>
                  {item.status}
                </strong>
              </p>
              {item.approved_by && (
                <p>
                  Approved by: <strong>{item.approved_by}</strong><br />
                  at: {item.approved_at && new Date(item.approved_at).toLocaleString()}
                </p>
              )}
              {item.status === "pending" && (
                <div className="actions">
                  <button onClick={() => handleEdit(item)} className="btn-edit" disabled={loading}>Edit</button>
                  <button onClick={() => handleDelete(item._id)} className="btn-delete" disabled={loading}>Delete</button>
                </div>
              )}
            </div>
          ))}
        </section>
      </main>
    </>
  );
}

export default UserInfo;
