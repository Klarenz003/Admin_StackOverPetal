// src/types/index.ts

export interface Customer {
  name: string
  email: string
  phone: string
  address: string
  date: string
  note?: string
}

export interface OrderItem {
  name: string
  price: string
  image: string
  quantity?: number
  preOrder?: boolean
  prepDays?: number
  deliveryRestrictions?: string
}

export interface OrderStatusHistory {
  id: string
  status: string
  label: string
  note?: string
  createdAt?: string
}

export type PaymentStatus  = 'Pending' | 'Verified' | 'Rejected'
export type DeliveryStatus = 'Processing' | 'Packed' | 'Shipped' | 'Delivered' | 'Cancelled'

export interface Order {
  id: string
  createdAt: string
  customer: Customer
  items: OrderItem[]
  total: string
  paymentMethod: string
  proofImage: string
  paymentStatus: PaymentStatus
  deliveryStatus: DeliveryStatus
  trackingStatus: string
  letterId?: string
  letterPublished?: boolean
  adminNote?: string
  statusHistory?: OrderStatusHistory[]
}

export interface Message {
  id: string
  createdAt: string
  name: string
  email: string
  subject: string
  message: string
  read: boolean
}

export type AdminTab = 'overview' | 'orders' | 'messages' | 'transactions' | 'products' | 'gallery' | 'letters' | 'delivery'
