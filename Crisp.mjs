import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { timeStamp } from "console";

class Crisp {
  constructor(repoPath = ".") {
    this.repoPath = path.join(repoPath, ".crisp");
    this.objectPath = path.join(this.repoPath, "objects");
    this.headPath = path.join(this.repoPath, "HEAD");
    this.indexPath = path.join(this.repoPath, "index");
    this.init();
  }

  async init() {
    await fs.mkdir(this.objectPath, { recursive: true });
    try {
      await fs.writeFile(this.headPath, "", { flag: "wx" });
    } catch (error) {
      if (error.code !== "EEXIST") {
        throw error;
      }
    }

    try {
      await fs.writeFile(this.indexPath, JSON.stringify([]), { flag: "wx" });
    } catch (error) {
      if (error.code !== "EEXIST") {
        throw error;
      } else {
        console.log("Already initialised in .crisp folder");
      }
    }
  }

  hashObject(content) {
    return crypto.createHash("sha1").update(content, "utf-8").digest("hex");
  }

  async add(fileToBeAdded) {
    const filedata = await fs.readFile(fileToBeAdded, { encoding: "utf-8" });
    const fileHash = this.hashObject(filedata);
    console.log(fileHash);

    const newFileHashedObjectPath = path.join(this.objectPath, fileHash);
    await fs.writeFile(newFileHashedObjectPath, filedata);
    await this.updateStagingArea(fileToBeAdded, fileHash);
    console.log(`Added ${fileToBeAdded}`);
  }

  async updateStagingArea(filePath, fileHash) {
    let index;
    try {
      index = JSON.parse(
        await fs.readFile(this.indexPath, { encoding: "utf-8" })
      );
    } catch (error) {
      if (error.code === "ENOENT") {
        index = [];
      } else {
        throw error;
      }
    }

    index.push({ path: filePath, hash: fileHash });

    await fs.writeFile(this.indexPath, JSON.stringify(index));
  }

  async commit(message) {
    const index = JSON.parse(
      await fs.readFile(this.indexPath, { encoding: "utf-8" })
    );
    const parentCommit = await this.getCurrentHead();

    const commitData = {
      timeStamp: new Date().toISOString(),
      message,
      files: index,
      parent: parentCommit,
    };

    const commitHash = this.hashObject(JSON.stringify(commitData));
    const commitPath = path.join(this.objectPath, commitHash);
    await fs.writeFile(commitPath, JSON.stringify(commitData));
    await fs.writeFile(this.headPath, commitHash); //Update new head
    await fs.writeFile(this.indexPath, JSON.stringify([]));
    console.log(`commit success : ${commitHash}`);
  }

  async getCurrentHead() {
    try {
      return await fs.readFile(this.headPath, { encoding: "utf-8" });
    } catch (error) {}
  }

  async log() {
    let currentCommitHash = await this.getCurrentHead();
    while (currentCommitHash) {
      const commitData = JSON.parse(
        await fs.readFile(path.join(this.objectPath, currentCommitHash), {
          encoding: "utf-8",
        })
      );
      console.log("---------------------------------------------------");
      console.log(
        `commit: ${currentCommitHash}nDate:${commitData.timeStamp}\n\n${commitData.message}\n\n`
      );

      currentCommitHash = commitData.parent;
    }
  }

  async showCommitDiff(commitHash) {
    const commitData = JSON.parse(await this.getCommitData(commitHash));
    if (!commitData) {
      console.log("Commit not found");
      return;
    }
    console.log("Changes in the last commit are: ");
    for (const file of commitData.files) {
      console.log(`File: ${file.path}`);
      const fileContent = await this.getFileContent(file.hash);
      console.log(fileContent);

      if (commitData.parent) {
        // get the parent commit data
        const parentCommitData = JSON.parse(
          await this.getCommitData(commitData.parent)
        );
        const getParentFileContent = await this.getParentFileContent(
          parentCommitData,
          file.path
        );
      }
    }
  }

  async getParentFileContent(parentCommitData, filePath) {
    const parentFile = parentCommitData.files.find(
      (file) => file.path === filePath
    );
    if (parentFile) {
      // get the file content from the parent commit and return the content
      return await this.getFileContent(parentFile.hash);
    }
  }

  async getCommitData(commithash) {
    const commitPath = path.join(this.objectsPath, commithash);
    try {
      return await fs.readFile(commitPath, { encoding: "utf-8" });
    } catch (error) {
      console.log("Failed to read the commit data", error);
      return null;
    }
  }

  async getFileContent(fileHash) {
    const objectPath = path.join(this.objectsPath, fileHash);
    return fs.readFile(objectPath, { encoding: "utf-8" });
  }
}

(async () => {
  const crisp = new Crisp();
  await crisp.add("test.txt");
  await crisp.commit("Initial commit");

  await crisp.log();
  await crisp.showCommitDiff("aec6eaa85befa7aa2ebacec9228b250aa8e97675");
})();
