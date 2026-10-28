import { z } from "zod";

export const credentialsSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "نام کاربری حداقل ۳ کاراکتر باشد")
    .max(32, "نام کاربری حداکثر ۳۲ کاراکتر باشد")
    .regex(/^[A-Za-z0-9_.]+$/, "فقط حروف انگلیسی، عدد، نقطه و _ مجاز است"),
  password: z.string().min(8, "رمز عبور حداقل ۸ کاراکتر باشد").max(72, "رمز عبور خیلی طولانی است"),
});
