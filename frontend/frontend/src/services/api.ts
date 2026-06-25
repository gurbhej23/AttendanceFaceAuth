import axios from "axios";
import { getApiBaseUrl } from "../config/backend";

const baseURL = getApiBaseUrl();
 
export const FACE_REQUEST_TIMEOUT_MS = 120_000;

const API = axios.create({
  baseURL,
  timeout: 30_000,
});

export default API;
