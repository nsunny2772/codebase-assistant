import {
  toast,
  ToastContainer as ReactToastContainer,
  type ToastContainerProps,
  type ToastOptions,
  type TypeOptions,
} from "react-toastify";

type ShowToastOptions = {
  message: string;
  type: TypeOptions;
  options?: Omit<ToastOptions, "type">;
};

export const showToast = ({ message, type, options }: ShowToastOptions) =>
  toast(message, { ...options, type });

export const Toast = (props: ToastContainerProps) => (
  <ReactToastContainer
    position="top-right"
    autoClose={5000}
    newestOnTop
    closeOnClick
    pauseOnFocusLoss
    draggable
    pauseOnHover
    theme="light"
    {...props}
  />
);

export default Toast;
