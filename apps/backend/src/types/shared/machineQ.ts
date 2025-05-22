// src/types/shared/machineq.ts

/**
 * MachineQ API configuration
 */
export interface MachineQConfig {
  tokenUrl: string;
  apiUrl: string;
}

/**
 * MachineQ API response
 */
export interface MachineQResponse<T = any> {
  status: number;
  data?: T;
  error?: string | object;
}

/**
 * MachineQ API version
 */
export interface APIVersion {
  Semantic: string;
  Major: string;
  Minor: string;
  Patch: string;
}

/**
 * MachineQ device data
 */
export interface DeviceData {
  DevEUI?: string;
  Name?: string;
  AppKey?: string;
  NwkKey?: string;
  ApplicationKey?: string;
  ActivationType?: "OTAA" | "ABP";
  ServiceProfile?: string;
  DeviceProfile?: string;
  DecoderType?: string;
  OutputProfile?: string;
  PrivateData?: boolean;
  [key: string]: any;
}
