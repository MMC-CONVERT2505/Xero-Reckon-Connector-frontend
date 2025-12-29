// API Configuration and Service
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export interface ApiError {
  message: string;
  status?: number;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}

// API Client
class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseURL}${endpoint}`;
      const config: RequestInit = {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      };

      const response = await fetch(url, config);
      
      // Handle redirects (for OAuth flows)
      if (response.redirected) {
        return {
          data: { redirectUrl: response.url } as T,
        };
      }

      // Handle JSON responses
      if (response.headers.get('content-type')?.includes('application/json')) {
        const data = await response.json();
        
        if (!response.ok) {
          return {
            error: {
              message: data.message || data.error || 'An error occurred',
              status: response.status,
            },
          };
        }
        
        return { data };
      }

      // Handle text/HTML responses
      const text = await response.text();
      
      if (!response.ok) {
        return {
          error: {
            message: text || 'An error occurred',
            status: response.status,
          },
        };
      }

      return { data: text as T };
    } catch (error) {
      return {
        error: {
          message: error instanceof Error ? error.message : 'Network error occurred',
        },
      };
    }
  }

  async get<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async postForm<T>(endpoint: string, formData: FormData, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      headers: {
        // Don't set Content-Type for FormData, browser will set it with boundary
        ...options?.headers,
      },
      body: formData,
    });
  }
}

// Create API client instance
const apiClient = new ApiClient(API_BASE_URL);

// API Endpoints
export interface CustomerInfo {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  startDate: string;
  endDate: string;
}

export interface ToolFileResponse {
  id: number;
  file_name: string;
  Email: string;
}

export interface CustomerInfoResponse {
  status: string;
  job_id: number;
  message: string;
}

export interface XeroFile {
  id: string;
  name: string;
}

export interface JobResponse {
  id: number;
  job_name: string;
  status: string;
}

export interface MigrationRecordStatus {
  id: string;
  name: string;
  status: "pending" | "in-progress" | "completed" | "error";
  progress: number;
  count: number;
  migrated: number;
  errors: number;
}

export interface MigrationStatus {
  job_id: number;
  status: string;
  progress: number;
  records_migrated: number;
  total_records: number;
  total_errors?: number;  // Add optional total_errors property
  records: MigrationRecordStatus[];
  started_at?: string;
  updated_at?: string;
}



export interface MigrationListItem {
  job_id: number;
  status: string;
  progress: number;
  total_records: number;
  records_migrated: number;
  created_at?: string;
  updated_at?: string;
}

export interface MigrationDetailRecord {
  id: string;
  name: string;
  status: string;
  progress: number;
  count: number;
  migrated: number;
  errors: number;
  error_records?: ErrorRecord[];
}

export interface ErrorRecord {
  _id?: string;
  error: string;
  payload?: any;
  Date?: string;
  Contact?: string;
  Reference?: string;
  // Add other fields as needed from your MongoDB document
}

export interface MigrationRecordData {
  _id?: string;
  job_id: number;
  task_id?: number;
  is_pushed: number | string | boolean;
  error?: string | null;
  table_name?: string;
  [key: string]: any; // For dynamic fields like AccountID, Name, Type, etc.
}

export interface MigrationRecordsResponse {
  job_id: number;
  table_name: string;
  records: MigrationRecordData[];
  total: number;
  page: number;
  limit: number;
}


export interface MigrationDetails {
  job_id: number;
  status: string;
  progress: number;
  total_records: number;
  records_migrated: number;
  total_errors: number;
  records: MigrationDetailRecord[];
  created_at?: string;
  updated_at?: string;
}


// API Functions
export const api = {
  // Create tool file (customer info)


  

  getXeroFiles: async (jobId: number): Promise<ApiResponse<XeroFile[]>> => {
    return apiClient.get<XeroFile[]>(`/api/xero-files?job_id=${jobId}`);
  },

  selectXeroFile: async (jobId: number, fileId: string): Promise<ApiResponse<{ status: string }>> => {
    return apiClient.post<{ status: string }>(`/api/xero-files/select`, {
      job_id: jobId,
      file_id: fileId,
    });
  },

  createCustomerInfo: async (customerInfo: CustomerInfo): Promise<ApiResponse<CustomerInfoResponse>> => {
    return apiClient.post<CustomerInfoResponse>('/api/customer-info', {
      company_name: customerInfo.companyName,
      contact_name: customerInfo.contactName,
      email: customerInfo.email,
      phone: customerInfo.phone || '',
      start_date: customerInfo.startDate,
      end_date: customerInfo.endDate,
    });
  },
  
  createToolFile: async (customerInfo: CustomerInfo): Promise<ApiResponse<ToolFileResponse>> => {
    const formData = new FormData();
    formData.append('name', customerInfo.companyName);
    formData.append('email', customerInfo.email);
    
    return apiClient.postForm<ToolFileResponse>('/tool_file', formData);
  },

  // Connect Xero account
  connectXero: async (toolId: number): Promise<ApiResponse<{ redirectUrl: string }>> => {
    const response = await apiClient.get<{ redirectUrl: string } | string>(`/xero_connect/${toolId}`, {
      redirect: 'follow',
    } as RequestInit);
    
    // If it's a redirect, handle it
    if (response.data && typeof response.data === 'object' && 'redirectUrl' in response.data) {
      window.location.href = response.data.redirectUrl;
      return { data: response.data };
    }
    
    return { data: { redirectUrl: '' } };
  },

  // Connect Reckon account
  connectReckon: async (toolId: number): Promise<ApiResponse<{ redirectUrl: string }>> => {
    const response = await apiClient.get<{ redirectUrl: string } | string>(`/reckon_connect/${toolId}`, {
      redirect: 'follow',
    } as RequestInit);
    
    // If it's a redirect, handle it
    if (response.data && typeof response.data === 'object' && 'redirectUrl' in response.data) {
      window.location.href = response.data.redirectUrl;
      return { data: response.data };
    }
    
    return { data: { redirectUrl: '' } };
  },

  // Create migration job
  createJob: async (
    fileId: number,
    inputAccountId: number,
    outputAccountId: number,
    functions: string[],
    startDate: string,
    endDate: string
  ): Promise<ApiResponse<JobResponse>> => {
    const formData = new FormData();
    formData.append('input_account_id', inputAccountId.toString());
    formData.append('output_account_id', outputAccountId.toString());
    formData.append('start_date', startDate);
    formData.append('end_date', endDate);
    functions.forEach((fn) => formData.append('mycheckbox', fn));
    
    return apiClient.postForm<JobResponse>(`/filejobs/jobs/create/${fileId}`, formData);
  },

  startMigration: async (jobId: number): Promise<ApiResponse<{ status: string; job_id: number; redirect_url?: string }>> => {
    const response = await apiClient.post<{ status: string; job_id: number; redirect_url?: string }>(`/startjobmigration/${jobId}`);
    
    // Handle redirect if provided
    if (response.data?.redirect_url) {
      window.location.href = response.data.redirect_url;
      return response;
    }
    
    return response;
  },

  // Get job status
  getJobStatus: async (jobId: number): Promise<ApiResponse<MigrationStatus>> => {
    return apiClient.get<MigrationStatus>(`/jobs/${jobId}/status`);
  },

  // Login
  login: async (email: string, password: string): Promise<ApiResponse<any>> => {
    const formData = new FormData();
    formData.append('email', email);
    formData.append('password', password);
    
    return apiClient.postForm('/login', formData);
  },

  // Signup
  signup: async (data: {
    name: string;
    email: string;
    password: string;
    confirm_password: string;
    is_admin: boolean;
  }): Promise<ApiResponse<any>> => {
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('email', data.email);
    formData.append('password', data.password);
    formData.append('confirm_password', data.confirm_password);
    formData.append('is_admin', data.is_admin ? 'true' : 'false');
    
    return apiClient.postForm('/signup', formData);
  },


  getAllMigrations: async (): Promise<ApiResponse<MigrationListItem[]>> => {
    return apiClient.get<MigrationListItem[]>('/admin/migrations');
  },

  // Admin: Get migration details
  getMigrationDetails: async (jobId: number): Promise<ApiResponse<MigrationDetails>> => {
    return apiClient.get<MigrationDetails>(`/admin/migrations/${jobId}`);
  },

  // Admin: Get errors for a specific record type in a migration
  getMigrationErrors: async (jobId: number, recordType: string): Promise<ApiResponse<ErrorRecord[]>> => {
    return apiClient.get<ErrorRecord[]>(`/admin/migrations/${jobId}/errors/${recordType}`);
  },

  // Admin: Retry failed records
  retryMigration: async (jobId: number, recordType?: string): Promise<ApiResponse<{ status: string; message: string }>> => {
    const payload = recordType ? { record_type: recordType } : {};
    return apiClient.post<{ status: string; message: string }>(`/admin/migrations/${jobId}/retry`, payload);
  },


  getJobRecords: async (
    jobId: number, 
    tableName: string, 
    options?: { 
      is_pushed?: boolean; 
      has_error?: boolean; 
      page?: number; 
      limit?: number;
    }
  ): Promise<ApiResponse<MigrationRecordsResponse>> => {
    const params = new URLSearchParams();
    if (options?.is_pushed !== undefined) {
      params.append("is_pushed", String(options.is_pushed));
    }
    if (options?.has_error !== undefined) {
      params.append("has_error", String(options.has_error));
    }
    if (options?.page) {
      params.append("page", String(options.page));
    }
    if (options?.limit) {
      params.append("limit", String(options.limit));
    }
    
    const queryString = params.toString();
    const url = `/jobs/${jobId}/records/${tableName}${queryString ? `?${queryString}` : ''}`;
    return apiClient.get<MigrationRecordsResponse>(url);
  },


  // Update the retrySingleRecord function (around line 414-426):
retrySingleRecord: async (
  jobId: number, 
  recordId: string, 
  tableName: string,
  editedPayload?: any  // Add this parameter
): Promise<ApiResponse<{ status: string; message: string }>> => {
  return apiClient.post<{ status: string; message: string }>(
    `/admin/migrations/${jobId}/retry-record`,
    {
      record_id: recordId,
      table_name: tableName,
      edited_payload: editedPayload,  // Add this field
    }
  );
},
};





export default api;

