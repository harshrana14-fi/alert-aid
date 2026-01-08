/**
 * Geofencing Alert Service
 * Location-based automatic alerts when entering/exiting danger zones
 */

// Geofence definition
interface Geofence {
  id: string;
  name: string;
  type: GeofenceType;
  geometry: GeofenceGeometry;
  alertLevel: 'info' | 'warning' | 'danger' | 'critical';
  triggerOnEnter: boolean;
  triggerOnExit: boolean;
  triggerOnDwell: boolean;
  dwellTime?: number; // milliseconds
  active: boolean;
  validFrom?: Date;
  validUntil?: Date;
  metadata: GeofenceMetadata;
}

type GeofenceType = 
  | 'flood_zone'
  | 'earthquake_zone'
  | 'cyclone_path'
  | 'evacuation_zone'
  | 'safe_zone'
  | 'restricted_area'
  | 'relief_camp'
  | 'medical_facility'
  | 'shelter'
  | 'custom';

// Geometry types
type GeofenceGeometry = 
  | CircleGeometry 
  | PolygonGeometry 
  | CorridorGeometry;

interface CircleGeometry {
  type: 'circle';
  center: { latitude: number; longitude: number };
  radius: number; // meters
}

interface PolygonGeometry {
  type: 'polygon';
  coordinates: { latitude: number; longitude: number }[];
}

interface CorridorGeometry {
  type: 'corridor';
  path: { latitude: number; longitude: number }[];
  width: number; // meters
}

// Metadata for geofence
interface GeofenceMetadata {
  disasterType?: string;
  severity?: number;
  instructions?: string[];
  contacts?: EmergencyContact[];
  nearestShelter?: string;
  evacuationRoute?: string;
  lastUpdated: Date;
}

interface EmergencyContact {
  name: string;
  role: string;
  phone: string;
}

// Geofence event
interface GeofenceEvent {
  id: string;
  geofenceId: string;
  geofenceName: string;
  eventType: 'enter' | 'exit' | 'dwell';
  timestamp: Date;
  location: { latitude: number; longitude: number };
  alertLevel: string;
  message: string;
  acknowledged: boolean;
}

// User location tracking
interface TrackedLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: Date;
  speed?: number;
  heading?: number;
}

// Geofence monitoring status
interface MonitoringStatus {
  isActive: boolean;
  geofencesMonitored: number;
  currentLocation?: TrackedLocation;
  activeGeofences: string[];
  lastUpdate: Date;
}

// Alert configuration
interface AlertConfig {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  notificationEnabled: boolean;
  autoAcknowledge: boolean;
  acknowledgeTimeout: number;
  repeatInterval: number;
}

// Predefined danger zones for India
const PREDEFINED_DANGER_ZONES: Partial<Geofence>[] = [
  {
    name: 'Brahmaputra Flood Plain',
    type: 'flood_zone',
    geometry: {
      type: 'polygon',
      coordinates: [
        { latitude: 26.5, longitude: 89.5 },
        { latitude: 27.5, longitude: 89.5 },
        { latitude: 27.5, longitude: 95.0 },
        { latitude: 26.5, longitude: 95.0 },
      ],
    },
    alertLevel: 'warning',
  },
  {
    name: 'Mumbai Coastal Zone',
    type: 'cyclone_path',
    geometry: {
      type: 'corridor',
      path: [
        { latitude: 18.9, longitude: 72.8 },
        { latitude: 19.1, longitude: 72.85 },
        { latitude: 19.3, longitude: 72.9 },
      ],
      width: 10000,
    },
    alertLevel: 'danger',
  },
  {
    name: 'Uttarakhand Landslide Zone',
    type: 'restricted_area',
    geometry: {
      type: 'circle',
      center: { latitude: 30.7, longitude: 79.0 },
      radius: 50000,
    },
    alertLevel: 'warning',
  },
  {
    name: 'Chennai Flood Zone',
    type: 'flood_zone',
    geometry: {
      type: 'polygon',
      coordinates: [
        { latitude: 12.9, longitude: 80.1 },
        { latitude: 13.2, longitude: 80.1 },
        { latitude: 13.2, longitude: 80.3 },
        { latitude: 12.9, longitude: 80.3 },
      ],
    },
    alertLevel: 'warning',
  },
  {
    name: 'Gujarat Earthquake Zone',
    type: 'earthquake_zone',
    geometry: {
      type: 'circle',
      center: { latitude: 23.0, longitude: 70.0 },
      radius: 100000,
    },
    alertLevel: 'danger',
  },
];

class GeofencingService {
  private static instance: GeofencingService;
  private geofences: Map<string, Geofence> = new Map();
  private activeGeofences: Set<string> = new Set();
  private events: GeofenceEvent[] = [];
  private watchId: number | null = null;
  private dwellTimers: Map<string, NodeJS.Timeout> = new Map();
  private lastLocation: TrackedLocation | null = null;
  private alertConfig: AlertConfig = {
    soundEnabled: true,
    vibrationEnabled: true,
    notificationEnabled: true,
    autoAcknowledge: false,
    acknowledgeTimeout: 30000,
    repeatInterval: 60000,
  };
  private eventCallbacks: ((event: GeofenceEvent) => void)[] = [];
  private statusCallbacks: ((status: MonitoringStatus) => void)[] = [];

  private constructor() {
    this.initializePredefinedZones();
  }

  public static getInstance(): GeofencingService {
    if (!GeofencingService.instance) {
      GeofencingService.instance = new GeofencingService();
    }
    return GeofencingService.instance;
  }

  /**
   * Initialize predefined danger zones
   */
  private initializePredefinedZones(): void {
    PREDEFINED_DANGER_ZONES.forEach((zone, index) => {
      const geofence: Geofence = {
        id: `predefined-${index + 1}`,
        name: zone.name!,
        type: zone.type!,
        geometry: zone.geometry!,
        alertLevel: zone.alertLevel!,
        triggerOnEnter: true,
        triggerOnExit: true,
        triggerOnDwell: false,
        active: true,
        metadata: {
          lastUpdated: new Date(),
        },
      };
      this.geofences.set(geofence.id, geofence);
    });
  }

  /**
   * Create a new geofence
   */
  public createGeofence(geofence: Omit<Geofence, 'id'>): Geofence {
    const id = `geofence-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newGeofence: Geofence = {
      ...geofence,
      id,
      metadata: {
        ...geofence.metadata,
        lastUpdated: new Date(),
      },
    };
    
    this.geofences.set(id, newGeofence);
    
    // Check if user is already inside
    if (this.lastLocation && newGeofence.active) {
      this.checkGeofence(newGeofence, this.lastLocation);
    }
    
    this.notifyStatusChange();
    return newGeofence;
  }

  /**
   * Update existing geofence
   */
  public updateGeofence(id: string, updates: Partial<Geofence>): Geofence | null {
    const existing = this.geofences.get(id);
    if (!existing) return null;

    const updated: Geofence = {
      ...existing,
      ...updates,
      id,
      metadata: {
        ...existing.metadata,
        ...updates.metadata,
        lastUpdated: new Date(),
      },
    };

    this.geofences.set(id, updated);
    this.notifyStatusChange();
    return updated;
  }

  /**
   * Delete geofence
   */
  public deleteGeofence(id: string): boolean {
    const deleted = this.geofences.delete(id);
    if (deleted) {
      this.activeGeofences.delete(id);
      this.clearDwellTimer(id);
      this.notifyStatusChange();
    }
    return deleted;
  }

  /**
   * Start monitoring geofences
   */
  public startMonitoring(): boolean {
    if (this.watchId !== null) return true;

    if (!navigator.geolocation) {
      console.error('Geolocation not supported');
      return false;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (position) => this.handleLocationUpdate(position),
      (error) => this.handleLocationError(error),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    );

    this.notifyStatusChange();
    return true;
  }

  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    // Clear all dwell timers
    this.dwellTimers.forEach((timer) => clearTimeout(timer));
    this.dwellTimers.clear();

    this.notifyStatusChange();
  }

  /**
   * Handle location update
   */
  private handleLocationUpdate(position: GeolocationPosition): void {
    const location: TrackedLocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: new Date(position.timestamp),
      speed: position.coords.speed ?? undefined,
      heading: position.coords.heading ?? undefined,
    };

    this.lastLocation = location;

    // Check all active geofences
    this.geofences.forEach((geofence) => {
      if (geofence.active && this.isGeofenceValid(geofence)) {
        this.checkGeofence(geofence, location);
      }
    });

    this.notifyStatusChange();
  }

  /**
   * Handle location error
   */
  private handleLocationError(error: GeolocationPositionError): void {
    console.error('Location error:', error.message);
  }

  /**
   * Check if geofence is valid (within time bounds)
   */
  private isGeofenceValid(geofence: Geofence): boolean {
    const now = new Date();
    if (geofence.validFrom && now < geofence.validFrom) return false;
    if (geofence.validUntil && now > geofence.validUntil) return false;
    return true;
  }

  /**
   * Check single geofence against location
   */
  private checkGeofence(geofence: Geofence, location: TrackedLocation): void {
    const isInside = this.isInsideGeofence(geofence, location);
    const wasInside = this.activeGeofences.has(geofence.id);

    if (isInside && !wasInside) {
      // Entered geofence
      this.activeGeofences.add(geofence.id);
      
      if (geofence.triggerOnEnter) {
        this.triggerEvent(geofence, 'enter', location);
      }
      
      if (geofence.triggerOnDwell && geofence.dwellTime) {
        this.startDwellTimer(geofence, location);
      }
    } else if (!isInside && wasInside) {
      // Exited geofence
      this.activeGeofences.delete(geofence.id);
      this.clearDwellTimer(geofence.id);
      
      if (geofence.triggerOnExit) {
        this.triggerEvent(geofence, 'exit', location);
      }
    }
  }

  /**
   * Check if location is inside geofence
   */
  private isInsideGeofence(geofence: Geofence, location: TrackedLocation): boolean {
    switch (geofence.geometry.type) {
      case 'circle':
        return this.isInsideCircle(geofence.geometry, location);
      case 'polygon':
        return this.isInsidePolygon(geofence.geometry, location);
      case 'corridor':
        return this.isInsideCorridor(geofence.geometry, location);
      default:
        return false;
    }
  }

  /**
   * Check if inside circle geofence
   */
  private isInsideCircle(geometry: CircleGeometry, location: TrackedLocation): boolean {
    const distance = this.calculateDistance(
      location.latitude,
      location.longitude,
      geometry.center.latitude,
      geometry.center.longitude
    );
    return distance <= geometry.radius;
  }

  /**
   * Check if inside polygon geofence (Ray casting algorithm)
   */
  private isInsidePolygon(geometry: PolygonGeometry, location: TrackedLocation): boolean {
    const { latitude: y, longitude: x } = location;
    const polygon = geometry.coordinates;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].longitude;
      const yi = polygon[i].latitude;
      const xj = polygon[j].longitude;
      const yj = polygon[j].latitude;

      const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      
      if (intersect) inside = !inside;
    }

    return inside;
  }

  /**
   * Check if inside corridor geofence
   */
  private isInsideCorridor(geometry: CorridorGeometry, location: TrackedLocation): boolean {
    const { path, width } = geometry;
    const halfWidth = width / 2;

    for (let i = 0; i < path.length - 1; i++) {
      const distance = this.pointToLineDistance(
        location.latitude,
        location.longitude,
        path[i].latitude,
        path[i].longitude,
        path[i + 1].latitude,
        path[i + 1].longitude
      );

      if (distance <= halfWidth) return true;
    }

    return false;
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Calculate perpendicular distance from point to line segment
   */
  private pointToLineDistance(
    px: number, py: number,
    x1: number, y1: number,
    x2: number, y2: number
  ): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSq = dx * dx + dy * dy;

    let t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSq));

    const nearestX = x1 + t * dx;
    const nearestY = y1 + t * dy;

    return this.calculateDistance(px, py, nearestX, nearestY);
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Start dwell timer for geofence
   */
  private startDwellTimer(geofence: Geofence, location: TrackedLocation): void {
    this.clearDwellTimer(geofence.id);

    const timer = setTimeout(() => {
      if (this.activeGeofences.has(geofence.id)) {
        this.triggerEvent(geofence, 'dwell', location);
      }
    }, geofence.dwellTime!);

    this.dwellTimers.set(geofence.id, timer);
  }

  /**
   * Clear dwell timer
   */
  private clearDwellTimer(geofenceId: string): void {
    const timer = this.dwellTimers.get(geofenceId);
    if (timer) {
      clearTimeout(timer);
      this.dwellTimers.delete(geofenceId);
    }
  }

  /**
   * Trigger geofence event
   */
  private triggerEvent(
    geofence: Geofence,
    eventType: 'enter' | 'exit' | 'dwell',
    location: TrackedLocation
  ): void {
    const event: GeofenceEvent = {
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      geofenceId: geofence.id,
      geofenceName: geofence.name,
      eventType,
      timestamp: new Date(),
      location: { latitude: location.latitude, longitude: location.longitude },
      alertLevel: geofence.alertLevel,
      message: this.generateAlertMessage(geofence, eventType),
      acknowledged: false,
    };

    this.events.push(event);

    // Trigger alert
    this.triggerAlert(event, geofence);

    // Notify callbacks
    this.eventCallbacks.forEach((callback) => callback(event));
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(geofence: Geofence, eventType: 'enter' | 'exit' | 'dwell'): string {
    const action = eventType === 'enter' ? 'entered' : eventType === 'exit' ? 'exited' : 'dwelling in';
    let message = `You have ${action} ${geofence.name}`;

    switch (geofence.type) {
      case 'flood_zone':
        message += eventType === 'enter' 
          ? '. Flood risk area - stay alert and monitor water levels.'
          : '. You have left the flood risk area.';
        break;
      case 'earthquake_zone':
        message += eventType === 'enter'
          ? '. High seismic activity zone - be prepared for tremors.'
          : '. You have left the high seismic zone.';
        break;
      case 'cyclone_path':
        message += eventType === 'enter'
          ? '. Cyclone path warning - seek shelter immediately.'
          : '. You have left the cyclone path zone.';
        break;
      case 'evacuation_zone':
        message += eventType === 'enter'
          ? '. Evacuation in progress - follow marked routes.'
          : '. You have exited the evacuation zone.';
        break;
      case 'safe_zone':
        message += eventType === 'enter'
          ? '. You are now in a designated safe zone.'
          : '. You have left the safe zone - exercise caution.';
        break;
      case 'relief_camp':
        message += eventType === 'enter'
          ? '. Relief camp nearby - assistance available.'
          : '. You have left the relief camp area.';
        break;
      default:
        break;
    }

    if (geofence.metadata.instructions && geofence.metadata.instructions.length > 0) {
      message += ` Instructions: ${geofence.metadata.instructions[0]}`;
    }

    return message;
  }

  /**
   * Trigger alert (sound, vibration, notification)
   */
  private triggerAlert(event: GeofenceEvent, geofence: Geofence): void {
    // Vibration
    if (this.alertConfig.vibrationEnabled && navigator.vibrate) {
      const pattern = event.alertLevel === 'critical' 
        ? [200, 100, 200, 100, 200]
        : event.alertLevel === 'danger'
        ? [200, 100, 200]
        : [200];
      navigator.vibrate(pattern);
    }

    // Notification
    if (this.alertConfig.notificationEnabled && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(`Alert: ${geofence.name}`, {
          body: event.message,
          icon: '/alert-icon.png',
          tag: event.id,
          requireInteraction: event.alertLevel === 'critical',
        });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    }

    // Auto-acknowledge
    if (this.alertConfig.autoAcknowledge) {
      setTimeout(() => {
        this.acknowledgeEvent(event.id);
      }, this.alertConfig.acknowledgeTimeout);
    }
  }

  /**
   * Acknowledge event
   */
  public acknowledgeEvent(eventId: string): boolean {
    const event = this.events.find((e) => e.id === eventId);
    if (event) {
      event.acknowledged = true;
      return true;
    }
    return false;
  }

  /**
   * Get all geofences
   */
  public getGeofences(): Geofence[] {
    return Array.from(this.geofences.values());
  }

  /**
   * Get geofence by ID
   */
  public getGeofence(id: string): Geofence | undefined {
    return this.geofences.get(id);
  }

  /**
   * Get active geofences (user is currently inside)
   */
  public getActiveGeofences(): Geofence[] {
    return Array.from(this.activeGeofences)
      .map((id) => this.geofences.get(id))
      .filter((g): g is Geofence => g !== undefined);
  }

  /**
   * Get events
   */
  public getEvents(limit?: number): GeofenceEvent[] {
    const sorted = [...this.events].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
    return limit ? sorted.slice(0, limit) : sorted;
  }

  /**
   * Get unacknowledged events
   */
  public getUnacknowledgedEvents(): GeofenceEvent[] {
    return this.events.filter((e) => !e.acknowledged);
  }

  /**
   * Get monitoring status
   */
  public getStatus(): MonitoringStatus {
    return {
      isActive: this.watchId !== null,
      geofencesMonitored: Array.from(this.geofences.values()).filter((g) => g.active).length,
      currentLocation: this.lastLocation ?? undefined,
      activeGeofences: Array.from(this.activeGeofences),
      lastUpdate: new Date(),
    };
  }

  /**
   * Update alert configuration
   */
  public setAlertConfig(config: Partial<AlertConfig>): void {
    this.alertConfig = { ...this.alertConfig, ...config };
  }

  /**
   * Get alert configuration
   */
  public getAlertConfig(): AlertConfig {
    return { ...this.alertConfig };
  }

  /**
   * Subscribe to events
   */
  public onEvent(callback: (event: GeofenceEvent) => void): () => void {
    this.eventCallbacks.push(callback);
    return () => {
      const index = this.eventCallbacks.indexOf(callback);
      if (index > -1) this.eventCallbacks.splice(index, 1);
    };
  }

  /**
   * Subscribe to status changes
   */
  public onStatusChange(callback: (status: MonitoringStatus) => void): () => void {
    this.statusCallbacks.push(callback);
    return () => {
      const index = this.statusCallbacks.indexOf(callback);
      if (index > -1) this.statusCallbacks.splice(index, 1);
    };
  }

  /**
   * Notify status change
   */
  private notifyStatusChange(): void {
    const status = this.getStatus();
    this.statusCallbacks.forEach((callback) => callback(status));
  }

  /**
   * Check if a point is inside any active danger zone
   */
  public isInDangerZone(latitude: number, longitude: number): {
    inDanger: boolean;
    zones: Geofence[];
  } {
    const location: TrackedLocation = {
      latitude,
      longitude,
      accuracy: 0,
      timestamp: new Date(),
    };

    const dangerZones = Array.from(this.geofences.values())
      .filter((g) => 
        g.active && 
        (g.alertLevel === 'danger' || g.alertLevel === 'critical') &&
        this.isInsideGeofence(g, location)
      );

    return {
      inDanger: dangerZones.length > 0,
      zones: dangerZones,
    };
  }

  /**
   * Get nearest safe zone
   */
  public getNearestSafeZone(latitude: number, longitude: number): Geofence | null {
    const safeZones = Array.from(this.geofences.values())
      .filter((g) => g.active && g.type === 'safe_zone');

    if (safeZones.length === 0) return null;

    let nearest: Geofence | null = null;
    let minDistance = Infinity;

    for (const zone of safeZones) {
      const center = this.getGeofenceCenter(zone);
      const distance = this.calculateDistance(latitude, longitude, center.latitude, center.longitude);
      
      if (distance < minDistance) {
        minDistance = distance;
        nearest = zone;
      }
    }

    return nearest;
  }

  /**
   * Get geofence center point
   */
  private getGeofenceCenter(geofence: Geofence): { latitude: number; longitude: number } {
    switch (geofence.geometry.type) {
      case 'circle':
        return geofence.geometry.center;
      case 'polygon': {
        const coords = geofence.geometry.coordinates;
        const lat = coords.reduce((sum, c) => sum + c.latitude, 0) / coords.length;
        const lng = coords.reduce((sum, c) => sum + c.longitude, 0) / coords.length;
        return { latitude: lat, longitude: lng };
      }
      case 'corridor': {
        const path = geofence.geometry.path;
        const midIndex = Math.floor(path.length / 2);
        return path[midIndex];
      }
    }
  }

  /**
   * Clear all events
   */
  public clearEvents(): void {
    this.events = [];
  }
}

export const geofencingService = GeofencingService.getInstance();
export type {
  Geofence,
  GeofenceType,
  GeofenceGeometry,
  GeofenceEvent,
  MonitoringStatus,
  AlertConfig,
  TrackedLocation,
};
