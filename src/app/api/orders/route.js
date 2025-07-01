export const runtime = "nodejs";
import mongoose from "mongoose";
import { connectMongoDB } from "../../../../lib/mongodb";
import Order from "../../../../models/order";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/authOptions";
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Helper: Check if user role is allowed to perform an action
function checkRole(session, allowedRoles) {
  if (!session) return false;
  const role = session.user.role?.toLowerCase();
  return allowedRoles.includes(role);
}

// GET /orders - fetch orders based on role
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) 
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    await connectMongoDB();

    const { searchParams } = new URL(req.url);
    const page = Math.max(parseInt(searchParams.get("page") ?? "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "10", 10), 1), 100);
    const skip = (page - 1) * limit;

    const role = session.user.role?.toLowerCase();
    const username = session.user.name?.trim();
    const query = {};

    // Role-based order filtering
    if (role === "manager") {
      query.status = "pending";
    } else if (role === "accountant") {
      query.status = "approved";
    } else if (role === "user") {
      query.username = username;
    } else {
      return NextResponse.json({ message: "Invalid role" }, { status: 403 });
    }

    const [orders, total] = await Promise.all([
      Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Order.countDocuments(query),
    ]);

    return NextResponse.json({
      orders,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("GET error:", err);
    return NextResponse.json({ message: "Failed to fetch orders" }, { status: 500 });
  }
}

// POST /orders - create order (only user role allowed)
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) 
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    // Only users can create orders
    if (!checkRole(session, ["user"])) {
      return NextResponse.json({ message: "Forbidden: insufficient permissions" }, { status: 403 });
    }

    await connectMongoDB();

    const { username, name, description, price, quantity } = await req.json();
    if (!username || !name || !description || price == null || quantity == null) {
      return NextResponse.json({ message: "Missing fields" }, { status: 400 });
    }

    const newOrder = await Order.create({ username, name, description, price, quantity, status: "pending" });
    return NextResponse.json({ order: newOrder }, { status: 201 });
  } catch (err) {
    console.error("POST error:", err);
    return NextResponse.json({ message: err.message || "Creation failed" }, { status: 500 });
  }
}

// PUT /orders?id=... - update order (user can update own orders, manager/accountant forbidden here)
export async function PUT(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) 
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    await connectMongoDB();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!isValidObjectId(id)) 
      return NextResponse.json({ message: "Invalid id" }, { status: 400 });

    // Only users can update their own orders (for example)
    const role = session.user.role?.toLowerCase();
    if (role !== "user") {
      return NextResponse.json({ message: "Forbidden: only users can update orders" }, { status: 403 });
    }

    const updates = await req.json();

    // Optional: prevent user from updating status or approved fields
    delete updates.status;
    delete updates.approved_by;
    delete updates.approved_at;

    // Verify ownership: update only if username matches session user
    const order = await Order.findById(id);
    if (!order) return NextResponse.json({ message: "Not found" }, { status: 404 });
    if (order.username !== session.user.name?.trim()) {
      return NextResponse.json({ message: "Forbidden: cannot update others' orders" }, { status: 403 });
    }

    const updated = await Order.findByIdAndUpdate(id, updates, { new: true });
    return NextResponse.json({ order: updated });
  } catch (err) {
    console.error("PUT error:", err);
    return NextResponse.json({ message: err.message || "Update failed" }, { status: 500 });
  }
}

// PATCH /orders?id=... - update status (only manager can approve/reject)
export async function PATCH(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) 
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    await connectMongoDB();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!isValidObjectId(id)) 
      return NextResponse.json({ message: "Invalid id" }, { status: 400 });

    const role = session.user.role?.toLowerCase();
    if (role !== "manager") {
      return NextResponse.json({ message: "Forbidden: only managers can update order status" }, { status: 403 });
    }

    const { status: newStatus } = await req.json();
    if (!["pending", "approved", "rejected"].includes(newStatus)) {
      return NextResponse.json({ message: "Invalid status" }, { status: 400 });
    }

    const updated = await Order.findByIdAndUpdate(
      id,
      { status: newStatus, approved_by: session.user.id, approved_at: new Date() },
      { new: true }
    );
    if (!updated) return NextResponse.json({ message: "Not found" }, { status: 404 });

    return NextResponse.json({ order: updated });
  } catch (err) {
    console.error("PATCH error:", err);
    return NextResponse.json({ message: err.message || "Status update failed" }, { status: 500 });
  }
}

// DELETE /orders?id=... - delete order (user can delete own orders, manager forbidden)
export async function DELETE(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) 
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    await connectMongoDB();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!isValidObjectId(id)) 
      return NextResponse.json({ message: "Invalid id" }, { status: 400 });

    const role = session.user.role?.toLowerCase();

    // Only user can delete own orders (managers should not delete)
    if (role !== "user") {
      return NextResponse.json({ message: "Forbidden: only users can delete orders" }, { status: 403 });
    }

    // Verify ownership before deleting
    const order = await Order.findById(id);
    if (!order) return NextResponse.json({ message: "Not found" }, { status: 404 });
    if (order.username !== session.user.name?.trim()) {
      return NextResponse.json({ message: "Forbidden: cannot delete others' orders" }, { status: 403 });
    }

    await Order.findByIdAndDelete(id);
    return NextResponse.json({ message: "Deleted" });
  } catch (err) {
    console.error("DELETE error:", err);
    return NextResponse.json({ message: err.message || "Delete failed" }, { status: 500 });
  }
}
