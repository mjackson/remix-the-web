import { vi, expect, describe, afterEach, beforeEach, it } from "vitest";
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { S3FileStorage } from "./s3-file-storage.js";
import { LazyFile } from "@mjackson/lazy-file";

vi.mock("@aws-sdk/client-s3", () => {
  return {
    S3Client: vi.fn().mockImplementation(() => ({
      send: vi.fn(),
    })),
    HeadObjectCommand: vi.fn(),
    GetObjectCommand: vi.fn(),
    DeleteObjectCommand: vi.fn(),
  };
});

vi.mock("@aws-sdk/lib-storage", () => {
  return {
    Upload: vi.fn().mockReturnValue({
      done: vi.fn(),
    }),
  };
});

describe("S3FileStorage", () => {
  let s3Client: S3Client;
  let s3FileStorage: S3FileStorage;

  beforeEach(() => {
    s3Client = new S3Client();
    s3FileStorage = new S3FileStorage(s3Client, "test-bucket");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("checks if a file exists", async () => {
    const result = await s3FileStorage.has("existing-key");
    expect(result).toBe(true);
    expect(HeadObjectCommand).toHaveBeenCalledWith({
      Bucket: "test-bucket",
      Key: "existing-key",
    });
    expect(vi.mocked(s3Client.send).mock.calls[0][0]).toBeInstanceOf(
      HeadObjectCommand,
    );
  });

  it("stores a file", async () => {
    const file = new File(["content"], "file.txt");
    await s3FileStorage.set("file-key", file);

    expect(Upload).toHaveBeenCalledWith({
      client: s3Client,
      params: {
        Bucket: "test-bucket",
        Key: "file-key",
        Body: expect.any(ReadableStream),
      },
    });
    // @ts-ignore
    const uploadInstance = Upload.mock.results[0].value;
    expect(uploadInstance.done).toHaveBeenCalled();
  });

  it("retrieves a file", async () => {
    // @ts-ignore
    vi.mocked(s3Client.send).mockResolvedValueOnce({
      ContentLength: 123,
      ContentType: "text/plain",
    });

    const result = await s3FileStorage.get("existing-key");

    expect(HeadObjectCommand).toHaveBeenCalledWith({
      Bucket: "test-bucket",
      Key: "existing-key",
    });

    expect(result).toBeInstanceOf(LazyFile);
    expect(vi.mocked(s3Client.send).mock.calls[0][0]).toBeInstanceOf(
      HeadObjectCommand,
    );
  });

  it("removes a file", async () => {
    await s3FileStorage.remove("existing-key");
    expect(DeleteObjectCommand).toHaveBeenCalledWith({
      Bucket: "test-bucket",
      Key: "existing-key",
    });
    expect(vi.mocked(s3Client.send).mock.calls[0][0]).toBeInstanceOf(
      DeleteObjectCommand,
    );
  });
});
