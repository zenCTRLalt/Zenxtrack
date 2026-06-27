export interface TrackingLink {
  id: string;
  title: string;
  destinationUrl: string;
  creatorId: string;
  createdAt: any; // Timestamp or Date
  clicksCount: number;
}

export interface VisitRecord {
  id: string;
  linkId: string;
  timestamp: any; // Timestamp or Date
  ip: string;
  country: string;
  region: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  userAgent: string;
  method: 'ip' | 'gps';
}
