"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import "../assets/css/style.css";
import "../assets/css/user.css";
export default function ManagerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Redirect unauthenticated or unauthorized users
  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    else if (
      status === "authenticated" &&
      session?.user?.role?.toLowerCase() !== "manager"
    ) {
      router.push("/user/dashboard");
    }
  }, [status, session, router]);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/orders?page=1&limit=10");
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to fetch orders.");
      setOrders(json.orders);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id, status) => {
    if (!confirm(`Are you sure you want to ${status} this order?`)) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/orders?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to update status.");

      await fetchOrders(); // Refresh orders list
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch orders when session is valid and role is manager
  useEffect(() => {
    if (status === "authenticated" && session?.user?.role?.toLowerCase() === "manager") {
      fetchOrders();
    }
  }, [status, session]);

  if (status === "loading") return <p>Loading session...</p>;

  if (!session || session.user.role.toLowerCase() !== "manager") {
    return <p>Access denied.</p>;
  }

  return (
    <>
      <nav className="navbar">
        <div className="logo">Manager Dashboard</div>
        <div className="nav">
          <div className="toggle" onClick={() => setMenuOpen(!menuOpen)}>☰</div>

          <div className={`menu ${menuOpen ? "active" : ""}`}>
            <Link href="/manager/dashboard">Manager</Link>
            <Link href="/accountant/dashboard">Accountant</Link>
            <p>👤 <strong>{session.user.name}</strong></p>
            <button
              className="btn-delete"
              onClick={() => signOut()}
              disabled={loading}
            >
              Log Out
            </button>
          </div>
        </div>
      </nav>

      <h1 style={{ textAlign: "center", padding: "2rem 0" }}>Pending Orders</h1>

      <main className="products-container" style={{ padding: "2rem" }}>
        {error && <p style={{ color: "red", textAlign: "center" }}>{error}</p>}

        {loading ? (
          <p style={{ textAlign: "center" }}>Loading orders...</p>
        ) : orders.length === 0 ? (
          <p style={{ textAlign: "center" }}>No pending orders.</p>
        ) : (
          orders.map(order => (
            <div key={order._id} className="card" style={{ marginBottom: "1rem" }}>
              <h3>{order.name}</h3>
              <p>{order.description}</p>
              <p>Price: ₹{order.price} × Qty: {order.quantity}</p>
              <p>Requested by: <strong>{order.username}</strong></p>
              <p>Status: <strong>{order.status}</strong></p>

              {order.status === "approved" && order.approved_by?.name && (
                <p>
                  ✅ Approved by: <strong>{order.approved_by.name}</strong><br />
                  at: {order.approved_at ? new Date(order.approved_at).toLocaleString() : "N/A"}
                </p>
              )}

              {order.status === "pending" && (
                <div className="actions" style={{ marginTop: ".5rem" }}>
                  <button
                    onClick={() => handleStatusUpdate(order._id, "approved")}
                    className="btn-approve"
                    disabled={loading}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleStatusUpdate(order._id, "rejected")}
                    className="btn-reject"
                    disabled={loading}
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </main>
    </>
  );
}
