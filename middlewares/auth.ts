import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

const auth = (req: Request, res: Response, next: NextFunction) => {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
        return res.status(401).json({ message: "Access denied. No token provided." });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded as any;
        next();
    } catch (err) {
        res.status(400).json({ message: "Invalid token." });
    }
};

//Role Authorization Middleware
export const authorizeseRoles = (...allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!allowedRoles.includes(req.user?.role)) {
            return res.status(403).json({ message: "Access denied. Insufficient permissions." });
        }
        next();
    };
};

export default auth;