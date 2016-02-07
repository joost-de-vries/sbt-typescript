package devries.sbt.typescript


case class CompilerOptions(module:Option[String],
                           outFile:Option[String],
                           out:Option[String],
                           outDir:Option[String],
                           target:Option[String],
                           watch:Option[String],
                           inlineSources:Option[String],
                           inlineSourceMap:Option[String],
                           rootDir:Option[String],
                           sourceMap:Option[Boolean]
                          )

case class TsConfig(compilerOptions:Option[CompilerOptions],files:Option[List[String]],exclude:Option[List[String]]) {

}
