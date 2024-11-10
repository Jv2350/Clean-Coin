/** @format */

"use client";
import { useState, useCallback, useEffect } from "react";
import {
  Trash2,
  MapPin,
  Upload,
  CheckCircle,
  XCircle,
  Loader,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  createUser,
  getUserByEmail,
  createReport,
  updateRewardPoints,
  createNotification,
  getRecentReports,
  createTransaction,
} from "@/utils/db/actions";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

// Make sure to set your Gemini API key and GoMaps API key in your environment variables
const geminiApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const goMapsApiKey = process.env.NEXT_PUBLIC_GOMAPS_API_KEY; // Change this to your GoMaps Pro API key

export default function ReportPage() {
  const [user, setUser] = useState<{
    id: number;
    email: string;
    name: string;
  } | null>(null);
  const router = useRouter();

  const [reports, setReports] = useState<
    Array<{
      id: number;
      location: string;
      wasteType: string;
      amount: string;
      createdAt: string;
    }>
  >([]);

  const [newReport, setNewReport] = useState({
    location: "",
    type: "",
    amount: "",
  });

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<
    "idle" | "verifying" | "success" | "failure"
  >("idle");
  const [verificationResult, setVerificationResult] = useState<{
    wasteType: string;
    quantity: string;
    confidence: number;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setNewReport({ ...newReport, [name]: value });
  };

  const handleLocationChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { value } = e.target;
    setNewReport((prev) => ({ ...prev, location: value }));

    // Fetch location suggestions from GoMaps Pro API
    if (value) {
      const response = await fetch(
        `https://maps.gomaps.pro/maps/api/place/queryautocomplete/json?input=${encodeURIComponent(
          value
        )}&key=${goMapsApiKey}`
      );
      const data = await response.json();
      if (data.predictions) {
        setLocationSuggestions(
          data.predictions.map(
            (pred: { description: string }) => pred.description
          )
        );
      }
    } else {
      setLocationSuggestions([]);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setNewReport((prev) => ({ ...prev, location: suggestion }));
    setLocationSuggestions([]); // Clear suggestions after selection
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleVerify = async () => {
    if (!file) return;

    setVerificationStatus("verifying");

    try {
      const genAI = new GoogleGenerativeAI(geminiApiKey!);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const base64Data = await readFileAsBase64(file);

      const imageParts = [
        {
          inlineData: {
            data: base64Data.split(",")[1],
            mimeType: file.type,
          },
        },
      ];

      const prompt = `You are an expert in waste management and recycling. Analyze this image and provide:
        1. The type of waste (e.g., plastic, paper, glass, metal, organic)
        2. An estimate of the quantity or amount (in kg or liters)
        3. Your confidence level in this assessment (as a percentage)
        
        Respond in JSON format like this:
        {
          "wasteType": "type of waste",
          "quantity": "estimated quantity with unit",
          "confidence": confidence level as a number between 0 and 1
        }`;

      const result = await model.generateContent([prompt, ...imageParts]);
      const response = await result.response;
      const text = response.text();

      try {
        const parsedResult = JSON.parse(text);
        if (
          parsedResult.wasteType &&
          parsedResult.quantity &&
          parsedResult.confidence
        ) {
          setVerificationResult(parsedResult);
          setVerificationStatus("success");
          setNewReport({
            ...newReport,
            type: parsedResult.wasteType,
            amount: parsedResult.quantity,
          });
        } else {
          console.error("Invalid verification result:", parsedResult);
          setVerificationStatus("failure");
        }
      } catch (error) {
        console.error("Failed to parse JSON response:", text);
        setVerificationStatus("failure");
      }
    } catch (error) {
      console.error("Error verifying waste:", error);
      setVerificationStatus("failure");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationStatus !== "success" || !user) {
      toast.error("Please verify the waste before submitting or log in.");
      return;
    }

    setIsSubmitting(true);
    try {
      const report = (await createReport(
        user.id,
        newReport.location,
        newReport.type,
        newReport.amount,
        preview || undefined,
        verificationResult ? JSON.stringify(verificationResult) : undefined
      )) as any;

      const formattedReport = {
        id: report.id,
        location: report.location,
        wasteType: report.wasteType,
        amount: report.amount,
        createdAt: report.createdAt.toISOString().split("T")[0],
      };

      setReports([formattedReport, ...reports]);
      setNewReport({ location: "", type: "", amount: "" });
      setFile(null);
      setPreview(null);
      setVerificationStatus("idle");
      setVerificationResult(null);

      toast.success(
        `Report submitted successfully! You've earned points for reporting waste.`
      );
    } catch (error) {
      console.error("Error submitting report:", error);
      toast.error("Failed to submit report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const checkUser = async () => {
      const email = localStorage.getItem("userEmail");
      if (email) {
        let user = await getUserByEmail(email);
        if (!user) {
          user = await createUser(email, "Anonymous User");
        }
        setUser(user);

        const recentReports = await getRecentReports();
        const formattedReports = recentReports.map((report) => ({
          ...report,
          createdAt: report.createdAt.toISOString().split("T")[0],
        }));
        setReports(formattedReports);
      } else {
        router.push("/login");
      }
    };
    checkUser();
  }, [router]);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-semibold mb-6 text-gray-800">
        Report waste
      </h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-2xl shadow-lg mb-12">
        <div className="mb-8">
          <label
            htmlFor="waste-image"
            className="block text-lg font-medium text-gray-700 mb-2">
            Upload Waste Image
          </label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-xl hover:border-green-500 transition-colors duration-300">
            <div className="space-y-1 text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <div className="flex text-sm text-gray-600">
                <label
                  htmlFor="waste-image"
                  className="relative cursor-pointer bg-white rounded-md font-medium text-green-600 hover:text-green-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-green-500">
                  <span>Upload a file</span>
                  <input
                    id="waste-image"
                    name="waste-image"
                    type="file"
                    className="sr-only"
                    onChange={handleFileChange}
                    accept="image/*"
                  />
                </label>
                <p className="pl-1">or drag and drop</p>{" "}
              </div>{" "}
              <p className="text-xs text-gray-500">PNG, JPG up to 10MB</p>{" "}
            </div>{" "}
          </div>{" "}
          {preview && (
            <img
              src={preview}
              alt="Waste Preview"
              className="mt-4 h-40 w-full object-cover rounded-md"
            />
          )}{" "}
        </div>
        <div className="mb-4">
          <label
            htmlFor="location"
            className="block text-lg font-medium text-gray-700 mb-2">
            Location
          </label>
          <input
            type="text"
            name="location"
            value={newReport.location}
            onChange={handleLocationChange}
            className="border border-gray-300 rounded-md p-2 w-full"
            placeholder="Enter location"
          />
          {locationSuggestions.length > 0 && (
            <ul className="border border-gray-300 rounded-md mt-1 max-h-40 overflow-y-auto">
              {locationSuggestions.map((suggestion, index) => (
                <li
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="cursor-pointer hover:bg-gray-200 p-2">
                  {suggestion}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mb-4">
          <label
            htmlFor="type"
            className="block text-lg font-medium text-gray-700 mb-2">
            Waste Type
          </label>
          <input
            type="text"
            name="type"
            value={newReport.type}
            onChange={handleInputChange}
            className="border border-gray-300 rounded-md p-2 w-full"
            placeholder="Waste type will be auto-filled after verification"
            disabled
          />
        </div>

        <div className="mb-4">
          <label
            htmlFor="amount"
            className="block text-lg font-medium text-gray-700 mb-2">
            Estimated Amount
          </label>
          <input
            type="text"
            name="amount"
            value={newReport.amount}
            onChange={handleInputChange}
            className="border border-gray-300 rounded-md p-2 w-full"
            placeholder="Estimated amount will be auto-filled after verification"
            disabled
          />
        </div>

        <Button
          type="button"
          onClick={handleVerify}
          disabled={verificationStatus === "verifying" || isSubmitting}
          className="mt-4">
          {verificationStatus === "verifying" ? (
            <Loader className="animate-spin" />
          ) : (
            "Verify Waste"
          )}
        </Button>

        {verificationStatus === "success" && (
          <div className="mt-4 text-green-600">
            <CheckCircle className="inline-block" /> Waste verified
            successfully!
          </div>
        )}
        {verificationStatus === "failure" && (
          <div className="mt-4 text-red-600">
            <XCircle className="inline-block" /> Verification failed. Please try
            again.
          </div>
        )}

        <Button
          type="submit"
          className="mt-4"
          disabled={isSubmitting || verificationStatus !== "success"}>
          {isSubmitting ? <Loader className="animate-spin" /> : "Submit Report"}
        </Button>
      </form>

      <h2 className="text-2xl font-semibold mb-4">Recent Reports</h2>
      <div className="bg-white rounded-2xl shadow-lg">
        {reports.length > 0 ? (
          reports.map((report) => (
            <div key={report.id} className="border-b last:border-b-0 p-4">
              <div className="flex justify-between">
                <div>
                  <p className="text-lg font-medium">{report.location}</p>
                  <p className="text-sm text-gray-600">{report.wasteType}</p>
                  <p className="text-sm text-gray-600">{report.amount}</p>
                  <p className="text-xs text-gray-400">{report.createdAt}</p>
                </div>
                <Trash2 className="text-red-500 h-5 w-5" />
              </div>
            </div>
          ))
        ) : (
          <p className="text-gray-500 p-4">No reports submitted yet.</p>
        )}
      </div>
    </div>
  );
}
