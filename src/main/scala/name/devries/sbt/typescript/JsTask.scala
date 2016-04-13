package name.devries.sbt.typescript

import com.typesafe.sbt.jse.JsTaskImport.JsTaskKeys._
import com.typesafe.sbt.jse.{SbtJsEngine, SbtJsTask}
import com.typesafe.sbt.web.Import.WebKeys._
import com.typesafe.sbt.web.Import._
import sbt.Keys._
import sbt.{Def, _}
import SbtTypescript.typescriptWrapperTask
import SbtTypescript.autoImport._
import akka.actor.ActorRef
import akka.util.Timeout
import com.typesafe.jse.Engine.JsExecutionResult
import com.typesafe.jse.{Engine, LocalEngine}
import com.typesafe.sbt.jse.JsEngineImport.JsEngineKeys._
import com.typesafe.sbt.jse.SbtJsTask.JsTaskProtocol.ProblemResultsPair
import com.typesafe.sbt.web.SbtWeb._
import com.typesafe.sbt.web.incremental.OpResult
import com.typesafe.sbt.web._
import spray.json.{JsArray, JsString, JsValue, JsonParser}
import xsbti.Problem
import akka.pattern.ask
import com.typesafe.sbt.jse.SbtJsTask.{JsTaskFailure, JsTaskProtocol}

import scala.collection.immutable
import scala.concurrent.{Await, ExecutionContext, Future}


trait JsTask {
  /** adapted from SbtJsTask.addJsSourceFileTasks */
  def addJsSourceFileTasks(): Seq[Setting[_]] = {
    Seq(
      sourceDependencies in typescript := Nil,
      typescript in Assets := SbtJsTask.jsSourceFileTask(typescript, Assets).dependsOn(nodeModules in Plugin).value,
      typescript in TestAssets := SbtJsTask.jsSourceFileTask(typescript, TestAssets).dependsOn(nodeModules in Plugin).value,
      resourceManaged in typescript in Assets := webTarget.value / typescript.key.label / "main",
      resourceManaged in typescript in TestAssets := webTarget.value / typescript.key.label / "test",
      typescript := (typescript in Assets).value
    ) ++
      inConfig(Assets)(addUnscopedJsSourceFileTasks()) ++
      inConfig(TestAssets)(addUnscopedJsSourceFileTasks())
  }

  /** adapted from SbtJsTask.addUnscopedJsSourceFileTasks */
  private def addUnscopedJsSourceFileTasks(): Seq[Setting[_]] = {
    Seq(
      resourceGenerators <+= typescriptWrapperTask,
      managedResourceDirectories += (resourceManaged in typescript).value
    ) ++ inTask(typescript)(Seq(
      managedSourceDirectories ++= Def.settingDyn { sourceDependencies.value.map(resourceManaged in _).join }.value,
      managedSources ++= Def.taskDyn { sourceDependencies.value.join.map(_.flatten) }.value,
      sourceDirectories := unmanagedSourceDirectories.value ++ managedSourceDirectories.value,
      sources := unmanagedSources.value ++ managedSources.value
    ))
  }

  /**
    * Primary means of executing a JavaScript shell script for processing source files. unmanagedResources is assumed
    * to contain the source files to filter on.
    * @param task The task to resolve js task settings from - relates to the concrete plugin sub class
    * @param config The sbt configuration to use e.g. Assets or TestAssets
    * @return A task object
    */
  def jsSourceFileTask(
                        task: TaskKey[Seq[File]],
                        config: Configuration
                      ): Def.Initialize[Task[Seq[File]]] = Def.task {

    val nodeModulePaths = (nodeModuleDirectories in Plugin).value.map(_.getCanonicalPath)
    val engineProps = SbtJsEngine.engineTypeToProps(
      (engineType in task).value,
      (command in task).value,
      LocalEngine.nodePathEnv(nodeModulePaths.to[immutable.Seq])
    )

    val sources = ((Keys.sources in task in config).value ** ((includeFilter in task in config).value -- (excludeFilter in task in config).value)).get

    val logger: Logger = state.value.log

    implicit val opInputHasher = (fileInputHasher in task in config).value
    val results: (Set[File], Seq[Problem]) = incremental.syncIncremental((streams in config).value.cacheDirectory / "run", sources) {
      modifiedSources: Seq[File] =>

        if (modifiedSources.size > 0) {

          streams.value.log.info(s"${(taskMessage in task in config).value} on ${
            modifiedSources.size
          } source(s)")

          val resultBatches: Seq[Future[(FileOpResultMappings, Seq[Problem])]] =
            try {
              val sourceBatches = (modifiedSources grouped Math.max(modifiedSources.size / (parallelism in task).value, 1)).toSeq
              sourceBatches.map {
                sourceBatch =>
                  withActorRefFactory(state.value, this.getClass.getName) {
                    arf =>
                      val engine = arf.actorOf(engineProps)
                      implicit val timeout = Timeout((timeoutPerSource in task in config).value * modifiedSources.size)
                      executeSourceFilesJs(
                        engine,
                        (shellSource in task in config).value,
                        sourceBatch.pair(relativeTo((sourceDirectories in task in config).value)),
                        (resourceManaged in task in config).value,
                        (jsOptions in task in config).value,
                        m => logger.error(m),
                        m => logger.info(m)
                      )
                  }
              }
            }

          import scala.concurrent.ExecutionContext.Implicits.global
          val pendingResults = Future.sequence(resultBatches)
          val completedResults = Await.result(pendingResults, (timeoutPerSource in task in config).value * modifiedSources.size)

          completedResults.foldLeft((FileOpResultMappings(), Seq[Problem]())) {
            (allCompletedResults, completedResult) =>

              val (prevOpResults, prevProblems) = allCompletedResults

              val (nextOpResults, nextProblems) = completedResult

              (prevOpResults ++ nextOpResults, prevProblems ++ nextProblems)
          }

        } else {
          (FileOpResultMappings(), Nil)
        }
    }

    val (filesWritten, problems) = results

    CompileProblems.report((reporter in task).value, problems)

    filesWritten.toSeq
  }

  /** below are unchanged private from SbtJsTask */
  private type FileOpResultMappings = Map[File, OpResult]

  private def FileOpResultMappings(s: (File, OpResult)*): FileOpResultMappings = Map(s: _*)

  private def executeSourceFilesJs(
                                    engine: ActorRef,
                                    shellSource: File,
                                    sourceFileMappings: Seq[PathMapping],
                                    target: File,
                                    options: String,
                                    stderrSink: String => Unit,
                                    stdoutSink: String => Unit
                                  )(implicit timeout: Timeout): Future[(FileOpResultMappings, Seq[Problem])] = {

    import ExecutionContext.Implicits.global

    val args = immutable.Seq(
      JsArray(sourceFileMappings.map(x => JsArray(JsString(x._1.getCanonicalPath), JsString(x._2))).toVector).toString(),
      target.getAbsolutePath,
      options
    )

    executeJsOnEngine(engine, shellSource, args, stderrSink, stdoutSink).map {
      results =>
        import JsTaskProtocol._
        val prp = results.foldLeft(ProblemResultsPair(Nil, Nil)) {
          (cumulative, result) =>
            val prp = result.convertTo[ProblemResultsPair]
            ProblemResultsPair(
              cumulative.results ++ prp.results,
              cumulative.problems ++ prp.problems
            )
        }
        (prp.results.map(sr => sr.source -> sr.result).toMap, prp.problems)
    }
  }

  private def executeJsOnEngine(engine: ActorRef, shellSource: File, args: Seq[String],
                                stderrSink: String => Unit, stdoutSink: String => Unit)
                               (implicit timeout: Timeout, ec: ExecutionContext): Future[Seq[JsValue]] = {

    (engine ? Engine.ExecuteJs(
      shellSource,
      args.to[immutable.Seq],
      timeout.duration
    )).mapTo[JsExecutionResult].map {
      result =>

        // Stuff below probably not needed once jsengine is refactored to stream this

        // Dump stderr as is
        if (!result.error.isEmpty) {
          stderrSink(new String(result.error.toArray, NodeEncoding))
        }

        // Split stdout into lines
        val outputLines = new String(result.output.toArray, NodeEncoding).split("\r?\n")

        // Iterate through lines, extracting out JSON messages, and printing the rest out
        val results = outputLines.foldLeft(Seq.empty[JsValue]) {
          (results, line) =>
            if (line.indexOf(JsonEscapeChar) == -1) {
              stdoutSink(line)
              results
            } else {
              val (out, json) = line.span(_ != JsonEscapeChar)
              if (!out.isEmpty) {
                stdoutSink(out)
              }
              results :+ JsonParser(json.drop(1))
            }
        }

        if (result.exitValue != 0) {
          throw new JsTaskFailure(new String(result.error.toArray, NodeEncoding))
        }
        results
    }

  }
  private val NodeEncoding = "UTF-8"
  // Used to signal when the script is sending back structured JSON data
  private val JsonEscapeChar: Char = 0x10

}
