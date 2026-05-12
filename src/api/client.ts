import axios from "axios";
import store from "@/store";
import { logout } from "@/store/modules/authSlice";

const client = axios.create({
  baseURL: "/api",
  timeout: 30000,
});

client.interceptors.request.use((config) => {
  const token = store.getState().auth?.token ?? localStorage.getItem('ddnet_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      if (store.getState().auth) store.dispatch(logout());
      localStorage.removeItem('ddnet_token');
    }
    return Promise.reject(err);
  }
);

export default client;
