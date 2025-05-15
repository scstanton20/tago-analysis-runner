/**
 * MachineQ API Module
 * Core functionality for interacting with MachineQ API
 */
import { APIVersion, DeviceData, IMachineQService, MachineQConfig, MachineQResponse } from "types/index.js";

// MachineQ API configuration
const MQ_CONFIG: MachineQConfig = {
  tokenUrl: "https://oauth.machineq.net/oauth2/token",
  apiUrl: "https://api.machineq.net/v1",
};

// Default headers
const DEFAULT_HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

// Login via OAuth to get access token
async function getToken(clientId: string, clientSecret: string): Promise<string> {
  const formData = new URLSearchParams();
  formData.append("grant_type", "client_credentials");

  try {
    const response = await fetch(MQ_CONFIG.tokenUrl, {
      method: "POST",
      body: formData,
      headers: {
        Authorization: "Basic " + btoa(`${clientId}:${clientSecret}`),
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
    });

    if (response.ok) {
      const tokens = await response.json();
      const accessToken = tokens.access_token;
      return `Bearer ${accessToken}`;
    } else {
      throw new Error(
        `Failed to get token: ${response.status} ${response.statusText}`,
      );
    }
  } catch (error: any) {
    console.error(`Error in login: ${error.message}`);
    throw error;
  }
}

// Function to get API version
async function getAPIVersion(): Promise<APIVersion> {
  const verUrl = `${MQ_CONFIG.apiUrl}/version`;
  try {
    const response = await fetch(verUrl);
    if (response.ok) {
      const data = await response.json();
      return data;
    } else {
      // /version wasn't implemented before 1.0.0, set it to 0.4.0
      return { Semantic: "0.4.0", Major: "0", Minor: "4", Patch: "0" };
    }
  } catch (error: any) {
    console.error(`Error getting API version: ${error.message}`);
    return { Semantic: "0.4.0", Major: "0", Minor: "4", Patch: "0" };
  }
}

//* GET Functions
// Generic function for API GET calls
async function getAPICall<T = any>(endpoint: string, token: string): Promise<MachineQResponse<T>> {
  const finalUrl = `${MQ_CONFIG.apiUrl}/${endpoint}`;
  const headers = { ...DEFAULT_HEADERS, Authorization: token };

  try {
    const response = await fetch(finalUrl, { headers });

    if (response.ok) {
      const data = await response.json();
      return { status: response.status, data };
    } else {
      return { status: response.status, error: response.statusText };
    }
  } catch (error: any) {
    console.error(`Error in API call to ${finalUrl}: ${error.message}`);
    return { status: 500, error: error.message };
  }
}

// Get devices
async function getDevices(token: string): Promise<MachineQResponse> {
  return getAPICall("devices", token);
}

// Get gateways
async function getGateways(token: string): Promise<MachineQResponse> {
  return getAPICall("gateways", token);
}

// Get account
async function getAccount(token: string): Promise<MachineQResponse> {
  return getAPICall("account", token);
}

//* POST Functions
// Create a new device
async function createDevice(token: string, deviceData: DeviceData): Promise<MachineQResponse> {
  const finalUrl = `${MQ_CONFIG.apiUrl}/devices`;
  const headers = { ...DEFAULT_HEADERS, Authorization: token };

  // Provide default values for required fields if not provided
  const defaultDeviceData: DeviceData = {
    ActivationType: "OTAA",
    ServiceProfile: "UyLtjJAT",
    DeviceProfile: "zsi0h2lg",
    DecoderType: "Nez4HkZe",
    OutputProfile: "VvvcmU0o",
    PrivateData: false,
  };

  // Merge default data with provided data
  const finalDeviceData = { ...defaultDeviceData, ...deviceData };

  try {
    const response = await fetch(finalUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(finalDeviceData),
    });

    if (response.ok) {
      const data = await response.json();
      return { status: response.status, data };
    } else {
      // Try to get more detailed error information
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = response.statusText;
      }

      return { status: response.status, error: errorData };
    }
  } catch (error: any) {
    console.error(`Error creating device: ${error.message}`);
    return { status: 500, error: error.message };
  }
}

// Export as a service implementation
const mqAPIService: IMachineQService = {
  getAPIVersion,
  getDevices,
  getGateways,
  getAccount,
  getAPICall,
  getToken,
  createDevice,
};

export default {
  ...mqAPIService,
  config: MQ_CONFIG,
};