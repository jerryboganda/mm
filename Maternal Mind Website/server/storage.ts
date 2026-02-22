import {
  type User, type InsertUser,
  type WaitlistEntry, type InsertWaitlist,
  type NewsletterEntry, type InsertNewsletter,
  type ContactMessage, type InsertContact,
  type InstitutionalRequest, type InsertInstitutionalRequest,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createWaitlistEntry(entry: InsertWaitlist): Promise<WaitlistEntry>;
  createNewsletterEntry(entry: InsertNewsletter): Promise<NewsletterEntry>;
  createContactMessage(message: InsertContact): Promise<ContactMessage>;
  createInstitutionalRequest(request: InsertInstitutionalRequest): Promise<InstitutionalRequest>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private waitlist: Map<string, WaitlistEntry>;
  private newsletter: Map<string, NewsletterEntry>;
  private contacts: Map<string, ContactMessage>;
  private instRequests: Map<string, InstitutionalRequest>;

  constructor() {
    this.users = new Map();
    this.waitlist = new Map();
    this.newsletter = new Map();
    this.contacts = new Map();
    this.instRequests = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createWaitlistEntry(entry: InsertWaitlist): Promise<WaitlistEntry> {
    const id = randomUUID();
    const waitlistEntry: WaitlistEntry = { ...entry, id, createdAt: new Date() };
    this.waitlist.set(id, waitlistEntry);
    return waitlistEntry;
  }

  async createNewsletterEntry(entry: InsertNewsletter): Promise<NewsletterEntry> {
    const id = randomUUID();
    const newsletterEntry: NewsletterEntry = { ...entry, id, createdAt: new Date() };
    this.newsletter.set(id, newsletterEntry);
    return newsletterEntry;
  }

  async createContactMessage(message: InsertContact): Promise<ContactMessage> {
    const id = randomUUID();
    const contactMessage: ContactMessage = { ...message, id, createdAt: new Date() };
    this.contacts.set(id, contactMessage);
    return contactMessage;
  }

  async createInstitutionalRequest(request: InsertInstitutionalRequest): Promise<InstitutionalRequest> {
    const id = randomUUID();
    const instRequest: InstitutionalRequest = {
      ...request,
      id,
      cohortSize: request.cohortSize ?? null,
      message: request.message ?? null,
      createdAt: new Date(),
    };
    this.instRequests.set(id, instRequest);
    return instRequest;
  }
}

export const storage = new MemStorage();
