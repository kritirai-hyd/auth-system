import mongoose from "mongoose";
import { connectMongoDB } from "../../../../lib/mongodb";
import Order from "../../../../models/order";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../app/api/auth/[...nextauth]/route";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

function checkRole(session, allowedRoles) {
  if (!session) return false;
  const role = session.user.role?.toLowerCase();
  return allowedRoles.includes(role);
}

// GET /orders
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    await connectMongoDB();

    const { searchParams } = new URL(req.url);
    const page = Math.max(parseInt(searchParams.get("page") ?? "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "10", 10), 1), 100);
    const skip = (page - 1) * limit;

    const role = session.user.role?.toLowerCase();
    const username = session.user.name?.trim();
    const query = {};

    if (role === "manager") query.status = "pending";
    else if (role === "accountant") query.status = "approved";
    else if (role === "user") query.username = username;
    else return NextResponse.json({ message: "Invalid role" }, { status: 403 });

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

// POST /orders - create order (only user)
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (!checkRole(session, ["user"])) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    await connectMongoDB();

    const { username, name, description, price, quantity } = await req.json();
    if (!username || !name || !description || price == null || quantity == null) {
      return NextResponse.json({ message: "Missing fields" }, { status: 400 });
    }

    const newOrder = await Order.create({ username, name, description, price, quantity, status: "pending" });
    return NextResponse.json({ order: newOrder }, { status: 201 });
  } catch (err) {
    console.error("POST error:", err);
    return NextResponse.json({ message: "Creation failed" }, { status: 500 });
  }
}

// PUT /orders?id=... - update order (only user, own orders)
export async function PUT(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    await connectMongoDB();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!isValidObjectId(id)) return NextResponse.json({ message: "Invalid id" }, { status: 400 });

    if (session.user.role?.toLowerCase() !== "user") {
      return NextResponse.json({ message: "Forbidden: only users can update orders" }, { status: 403 });
    }

    const updates = await req.json();
    delete updates.status;
    delete updates.approved_by;
    delete updates.approved_at;

    const order = await Order.findById(id);
    if (!order) return NextResponse.json({ message: "Not found" }, { status: 404 });
    if (order.username !== session.user.name?.trim()) {
      return NextResponse.json({ message: "Forbidden: cannot update others' orders" }, { status: 403 });
    }

    const updated = await Order.findByIdAndUpdate(id, updates, { new: true });
    return NextResponse.json({ order: updated });
  } catch (err) {
    console.error("PUT error:", err);
    return NextResponse.json({ message: "Update failed" }, { status: 500 });
  }
}

// PATCH /orders?id=... - update status (only manager)
export async function PATCH(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    await connectMongoDB();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!isValidObjectId(id)) return NextResponse.json({ message: "Invalid id" }, { status: 400 });

    if (session.user.role?.toLowerCase() !== "manager") {
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
    return NextResponse.json({ message: "Status update failed" }, { status: 500 });
  }
}

// DELETE /orders?id=... - delete order (only user, own orders)
export async function DELETE(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    await connectMongoDB();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!isValidObjectId(id)) return NextResponse.json({ message: "Invalid id" }, { status: 400 });

    if (session.user.role?.toLowerCase() !== "user") {
      return NextResponse.json({ message: "Forbidden: only users can delete orders" }, { status: 403 });
    }

    const order = await Order.findById(id);
    if (!order) return NextResponse.json({ message: "Not found" }, { status: 404 });
    if (order.username !== session.user.name?.trim()) {
      return NextResponse.json({ message: "Forbidden: cannot delete others' orders" }, { status: 403 });
    }

    await Order.findByIdAndDelete(id);
    return NextResponse.json({ message: "Deleted" });
  } catch (err) {
    console.error("DELETE error:", err);
    return NextResponse.json({ message: "Delete failed" }, { status: 500 });
  }
}
