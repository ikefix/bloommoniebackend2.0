import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

const auth = (req: Request, res: Response, next: NextFunction) => {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
        return res.status(401).json({ message: "Access denied. No token provided." });
    }

    try {
        console.log('Auth Middleware Debug:');
        console.log('Token exists:', !!token);
        console.log('Token length:', token?.length);
        console.log('Token first 20 chars:', token?.substring(0, 20));
        console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Token decoded successfully:', decoded);
        req.user = decoded as any;
        next();
    } catch (err) {
        console.error('Token verification error:', err);
        console.error('Error name:', (err as any).name);
        console.error('Error message:', (err as any).message);
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